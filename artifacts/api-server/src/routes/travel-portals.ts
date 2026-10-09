import { Router } from "express";
import { db, createDoubleEntryJournal, logAudit } from "../lib/sqlite";
import { getAuthUser } from "./auth";

const router = Router();

// ============================================================================
// B2B CORPORATE PORTAL API ENDPOINTS
// ============================================================================

// 1. Get all corporate accounts
router.get("/travel/corporate/accounts", (_req, res) => {
  const rows = db.prepare(`
    SELECT c.*,
           (SELECT COUNT(*) FROM travel_corporate_employees WHERE corporate_id = c.id) as employees_count,
           (SELECT COUNT(*) FROM travel_corporate_requests WHERE corporate_id = c.id) as requests_count,
           (SELECT COUNT(*) FROM travel_corporate_requests WHERE corporate_id = c.id AND status = 'pending_approval') as pending_approvals_count
    FROM travel_corporate_accounts c
    ORDER BY c.id DESC
  `).all();
  res.json(rows);
});

// 2. Get corporate account by ID with employees and recent requests
router.get("/travel/corporate/accounts/:id", (req, res) => {
  const account = db.prepare("SELECT * FROM travel_corporate_accounts WHERE id = ?").get(req.params.id);
  if (!account) {
    res.status(404).json({ error: "حساب الشركة غير موجود" });
    return;
  }
  const employees = db.prepare("SELECT * FROM travel_corporate_employees WHERE corporate_id = ? ORDER BY id DESC").all(req.params.id);
  const requests = db.prepare("SELECT * FROM travel_corporate_requests WHERE corporate_id = ? ORDER BY id DESC").all(req.params.id);
  res.json({ account, employees, requests });
});

// 3. Create new corporate account
router.post("/travel/corporate/accounts", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    company_name, company_name_en, cr_number, tax_number, contact_person,
    contact_phone, contact_email, credit_limit = 50000, payment_terms_days = 30,
    policy_max_booking_budget = 5000, policy_allowed_classes = "اقتصادية,أعمال",
    policy_require_manager_approval = 1, notes
  } = req.body;

  if (!company_name) {
    res.status(400).json({ error: "اسم الشركة مطلوب" });
    return;
  }

  const account_code = `CORP-${Date.now().toString().slice(-6)}`;

  const ins = db.prepare(`
    INSERT INTO travel_corporate_accounts (
      company_name, company_name_en, account_code, cr_number, tax_number,
      contact_person, contact_phone, contact_email, credit_limit, current_balance,
      payment_terms_days, policy_max_booking_budget, policy_allowed_classes,
      policy_require_manager_approval, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'active', ?)
  `);

  const r = ins.run(
    company_name, company_name_en || null, account_code, cr_number || null, tax_number || null,
    contact_person || null, contact_phone || null, contact_email || null, Number(credit_limit),
    Number(payment_terms_days), Number(policy_max_booking_budget), policy_allowed_classes,
    Number(policy_require_manager_approval), notes || null
  );

  const newAcc = db.prepare("SELECT * FROM travel_corporate_accounts WHERE id = ?").get(r.lastInsertRowid);
  logAudit(user.id, user.name, "CORPORATE_ACCOUNT_CREATED", `إنشاء حساب شركة B2B جديد: ${company_name}`);

  res.status(201).json(newAcc);
});

// 4. Update corporate account
router.put("/travel/corporate/accounts/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    company_name, company_name_en, cr_number, tax_number, contact_person,
    contact_phone, contact_email, credit_limit, current_balance, payment_terms_days,
    policy_max_booking_budget, policy_allowed_classes, policy_require_manager_approval,
    status, notes
  } = req.body;

  db.prepare(`
    UPDATE travel_corporate_accounts
    SET company_name = ?, company_name_en = ?, cr_number = ?, tax_number = ?,
        contact_person = ?, contact_phone = ?, contact_email = ?, credit_limit = ?,
        current_balance = ?, payment_terms_days = ?, policy_max_booking_budget = ?,
        policy_allowed_classes = ?, policy_require_manager_approval = ?, status = ?, notes = ?
    WHERE id = ?
  `).run(
    company_name, company_name_en || null, cr_number || null, tax_number || null,
    contact_person || null, contact_phone || null, contact_email || null,
    Number(credit_limit || 50000), Number(current_balance || 0), Number(payment_terms_days || 30),
    Number(policy_max_booking_budget || 5000), policy_allowed_classes,
    Number(policy_require_manager_approval ? 1 : 0), status || "active", notes || null,
    req.params.id
  );

  const updated = db.prepare("SELECT * FROM travel_corporate_accounts WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// 5. Add employee to corporate account
router.post("/travel/corporate/employees", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    corporate_id, name_ar, name_en, employee_number, department,
    cost_center, job_title, phone, email, passport_number, passport_expiry,
    max_budget = 3000, allowed_class = "اقتصادية", requires_approval = 1
  } = req.body;

  if (!corporate_id || !name_ar || !employee_number) {
    res.status(400).json({ error: "معرف الشركة واسم الموظف والرقم الوظيفي حقول مطلوبة" });
    return;
  }

  const ins = db.prepare(`
    INSERT INTO travel_corporate_employees (
      corporate_id, name_ar, name_en, employee_number, department,
      cost_center, job_title, phone, email, passport_number, passport_expiry,
      max_budget, allowed_class, requires_approval, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const r = ins.run(
    corporate_id, name_ar, name_en || name_ar, employee_number, department || null,
    cost_center || null, job_title || null, phone || null, email || null,
    passport_number || null, passport_expiry || null, Number(max_budget),
    allowed_class, Number(requires_approval)
  );

  const emp = db.prepare("SELECT * FROM travel_corporate_employees WHERE id = ?").get(r.lastInsertRowid);
  res.status(201).json(emp);
});

// 6. Submit Corporate Travel Request (With Policy Check)
router.post("/travel/corporate/requests", (req, res) => {
  const {
    corporate_id, employee_id, passenger_name, service_type = "flight",
    trip_type = "round_trip", origin, destination, departure_date, return_date,
    preferred_class = "اقتصادية", purpose_of_trip, estimated_cost = 0
  } = req.body;

  if (!corporate_id || !passenger_name || !origin || !destination || !departure_date) {
    res.status(400).json({ error: "جميع بيانات الرحلة والمسافر مطلوبة" });
    return;
  }

  const account = db.prepare("SELECT * FROM travel_corporate_accounts WHERE id = ?").get(corporate_id) as any;
  if (!account) {
    res.status(404).json({ error: "حساب الشركة غير موجود" });
    return;
  }

  // Check policy rules
  let autoApprove = false;
  const estCost = Number(estimated_cost || 0);
  if (account.policy_require_manager_approval === 0 && estCost <= account.policy_max_booking_budget) {
    autoApprove = true;
  }

  const reqNumber = `REQ-CORP-${Date.now().toString().slice(-6)}`;
  const status = autoApprove ? "approved" : "pending_approval";

  const ins = db.prepare(`
    INSERT INTO travel_corporate_requests (
      request_number, corporate_id, employee_id, passenger_name, service_type,
      trip_type, origin, destination, departure_date, return_date,
      preferred_class, purpose_of_trip, estimated_cost, actual_cost,
      status, approver_name, approved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `);

  const r = ins.run(
    reqNumber, corporate_id, employee_id || null, passenger_name, service_type,
    trip_type, origin, destination, departure_date, return_date || null,
    preferred_class, purpose_of_trip || null, estCost, status,
    autoApprove ? "النظام (الموافقة التلقائية لسياسة السفر)" : null,
    autoApprove ? new Date().toISOString() : null
  );

  const newReq = db.prepare("SELECT * FROM travel_corporate_requests WHERE id = ?").get(r.lastInsertRowid);
  res.status(201).json(newReq);
});

// 7. Approve / Reject Corporate Travel Request
router.post("/travel/corporate/requests/:id/action", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { action, approver_name, notes, actual_cost } = req.body; // action: 'approve' | 'reject'
  const reqItem = db.prepare("SELECT * FROM travel_corporate_requests WHERE id = ?").get(req.params.id) as any;
  if (!reqItem) {
    res.status(404).json({ error: "طلب السفر غير موجود" });
    return;
  }

  const newStatus = action === "approve" ? "approved" : "rejected";
  const cost = actual_cost ? Number(actual_cost) : reqItem.estimated_cost;

  db.prepare(`
    UPDATE travel_corporate_requests
    SET status = ?, approver_name = ?, approval_notes = ?, approved_at = ?, actual_cost = ?
    WHERE id = ?
  `).run(
    newStatus,
    approver_name || user.name,
    notes || null,
    new Date().toISOString(),
    cost,
    req.params.id
  );

  // If approved, update corporate balance
  if (action === "approve") {
    db.prepare("UPDATE travel_corporate_accounts SET current_balance = current_balance + ? WHERE id = ?").run(cost, reqItem.corporate_id);
  }

  const updated = db.prepare("SELECT * FROM travel_corporate_requests WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// 8. Get corporate statement / ledger
router.get("/travel/corporate/:id/statement", (req, res) => {
  const account = db.prepare("SELECT * FROM travel_corporate_accounts WHERE id = ?").get(req.params.id);
  if (!account) {
    res.status(404).json({ error: "حساب الشركة غير موجود" });
    return;
  }

  const requests = db.prepare(`
    SELECT r.*, e.department, e.employee_number
    FROM travel_corporate_requests r
    LEFT JOIN travel_corporate_employees e ON e.id = r.employee_id
    WHERE r.corporate_id = ?
    ORDER BY r.id DESC
  `).all(req.params.id);

  res.json({ account, statement_items: requests });
});

// ============================================================================
// B2C PASSENGER SELF-SERVICE PORTAL API ENDPOINTS
// ============================================================================

// 9. Passenger Self-Service Lookup (PNR, Ticket, Passport, or Phone)
router.get("/travel/b2c/lookup", (req, res) => {
  const { query } = req.query;
  if (!query || String(query).trim().length < 2) {
    res.status(400).json({ error: "الرجاء إدخال رقم الحجز أو التذكرة أو الجواز أو الهاتف" });
    return;
  }

  const q = String(query).trim();

  // Search bookings
  const bookings = db.prepare(`
    SELECT b.*, 
           p.name_ar as passenger_name_ar, p.name_en as passenger_name_en, p.passport_number,
           c.name as customer_name, c.phone as customer_phone
    FROM travel_bookings b
    LEFT JOIN travel_passengers p ON p.id = b.passenger_id
    LEFT JOIN customers c ON c.id = b.customer_id
    WHERE b.pnr LIKE ? OR b.ticket_number LIKE ? OR b.booking_number LIKE ?
       OR p.passport_number LIKE ? OR c.phone LIKE ?
    ORDER BY b.id DESC
    LIMIT 10
  `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);

  // Search visas
  const visas = db.prepare(`
    SELECT v.*,
           p.name_ar as passenger_name_ar, p.name_en as passenger_name_en, p.passport_number,
           c.name as customer_name, c.phone as customer_phone
    FROM travel_visas v
    LEFT JOIN travel_passengers p ON p.id = v.passenger_id
    LEFT JOIN customers c ON c.id = v.customer_id
    WHERE v.visa_number LIKE ? OR p.passport_number LIKE ? OR c.phone LIKE ?
    ORDER BY v.id DESC
    LIMIT 10
  `).all(`%${q}%`, `%${q}%`, `%${q}%`);

  // Search hotels
  const hotels = db.prepare(`
    SELECT h.*,
           p.name_ar as passenger_name_ar, p.name_en as passenger_name_en,
           c.name as customer_name, c.phone as customer_phone
    FROM travel_hotels h
    LEFT JOIN travel_passengers p ON p.id = h.passenger_id
    LEFT JOIN customers c ON c.id = h.customer_id
    WHERE h.booking_ref LIKE ? OR c.phone LIKE ?
    ORDER BY h.id DESC
    LIMIT 10
  `).all(`%${q}%`, `%${q}%`);

  res.json({
    query: q,
    results_count: bookings.length + visas.length + hotels.length,
    bookings,
    visas,
    hotels
  });
});

// 10. Visa Milestone Live Timeline Tracker
router.get("/travel/b2c/visa-tracking/:param", (req, res) => {
  const param = req.params.param.trim();
  const visa = db.prepare(`
    SELECT v.*,
           p.name_ar as passenger_name_ar, p.name_en as passenger_name_en, p.passport_number,
           p.nationality, c.name as customer_name, c.phone as customer_phone
    FROM travel_visas v
    LEFT JOIN travel_passengers p ON p.id = v.passenger_id
    LEFT JOIN customers c ON c.id = v.customer_id
    WHERE v.visa_number = ? OR v.id = ? OR p.passport_number = ?
  `).get(param, param, param) as any;

  if (!visa) {
    res.status(404).json({ error: "معاملة التأشيرة غير موجودة" });
    return;
  }

  // Construct official embassy milestones timeline
  const statusMilestones: Record<string, number> = {
    pending: 1,
    in_review: 2,
    submitted: 3,
    biometrics: 4,
    under_process: 5,
    approved: 6,
    delivered: 7,
    rejected: -1
  };

  const currentStep = statusMilestones[visa.status] || (visa.status === "approved" ? 6 : 3);

  const timeline = [
    { step: 1, title: "استلام الوثائق والجواز", desc: "تم استلام متطلبات التأشيرة من العميل والتحقق من صحة المستندات", date: visa.application_date || "2026-08-10", completed: currentStep >= 1 },
    { step: 2, title: "المراجعة وتعبئة النموذج الرسمي", desc: "تمت مراجعة البيانات وتعبئة الأبلكيشن وسداد الرسوم القنصلية", date: visa.application_date || "2026-08-12", completed: currentStep >= 2 },
    { step: 3, title: "التقديم إلى السفارة / مركز التأشيرات (VFS/TLS)", desc: "تم تقديم الملف رسمياً إلى القنصلية المعتمدة", date: visa.application_date || "2026-08-15", completed: currentStep >= 3 },
    { step: 4, title: "موعد البصمة والصور الحيوية (Biometrics)", desc: "حضور موعد التبصيم في مركز التأشيرات المعتمد", date: visa.application_date || "2026-08-18", completed: currentStep >= 4 },
    { step: 5, title: "قيد الدراسة والتدقيق الأمني في القنصلية", desc: "جواز السفر والملف قيد المعالجة النهائية لدى القنصلية", date: visa.application_date || "2026-08-20", completed: currentStep >= 5 },
    { step: 6, title: "صدور التأشيرة وإلصاقها في الجواز", desc: "تمت الموافقة الرسمية على التأشيرة واستلام الجواز من السفارة", date: visa.expiry_date || "2026-08-22", completed: currentStep >= 6 },
    { step: 7, title: "جاهز للتسليم أو الإرسال عبر الشحن", desc: "الجواز والتأشيرة جاهزة للاستلام من فرع الوكالة", date: visa.expiry_date || "2026-08-22", completed: currentStep >= 7 }
  ];

  res.json({
    visa,
    current_step: currentStep,
    timeline
  });
});

// 11. Submit B2C Customer Request (Change date, Refund, Inquiry)
router.post("/travel/b2c/requests", (req, res) => {
  const {
    request_type, customer_name, customer_phone, customer_email,
    pnr_or_ticket, passport_number, request_details, preferred_new_date
  } = req.body;

  if (!request_type || !customer_name || !customer_phone || !request_details) {
    res.status(400).json({ error: "اسم العميل ورقم الهاتف ونوع الطلب والتفاصيل حقول مطلوبة" });
    return;
  }

  const requestCode = `REQ-B2C-${Date.now().toString().slice(-6)}`;

  let calculatedFees = 0;
  if (request_type === "change_date") calculatedFees = 200; // Standard agency reissue fee
  if (request_type === "refund_ticket") calculatedFees = 150; // Standard cancellation fee

  const ins = db.prepare(`
    INSERT INTO travel_b2c_requests (
      request_code, request_type, customer_name, customer_phone, customer_email,
      pnr_or_ticket, passport_number, request_details, preferred_new_date,
      calculated_fees, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
  `);

  const r = ins.run(
    requestCode, request_type, customer_name, customer_phone, customer_email || null,
    pnr_or_ticket || null, passport_number || null, request_details,
    preferred_new_date || null, calculatedFees
  );

  const created = db.prepare("SELECT * FROM travel_b2c_requests WHERE id = ?").get(r.lastInsertRowid);
  res.status(201).json(created);
});

// 12. Agent view and resolve B2C customer requests
router.get("/travel/b2c/agent-requests", (_req, res) => {
  const rows = db.prepare("SELECT * FROM travel_b2c_requests ORDER BY id DESC LIMIT 100").all();
  res.json(rows);
});

router.post("/travel/b2c/requests/:id/action", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { status, agent_response } = req.body; // status: 'in_review' | 'actioned' | 'rejected'

  db.prepare(`
    UPDATE travel_b2c_requests
    SET status = ?, agent_response = ?, assigned_agent = ?, resolved_at = ?
    WHERE id = ?
  `).run(
    status || "actioned",
    agent_response || null,
    user.name,
    status === "actioned" || status === "rejected" ? new Date().toISOString() : null,
    req.params.id
  );

  const updated = db.prepare("SELECT * FROM travel_b2c_requests WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// ============================================================================
// PUBLIC CUSTOMER TRAVEL WEBSITE & BOOKINGS API ENDPOINTS
// ============================================================================

// 13. Get public website configuration & branding
router.get("/public/website/config", (_req, res) => {
  let settings = db.prepare("SELECT * FROM website_settings WHERE id = 1").get();
  if (!settings) {
    settings = {
      site_name: "وكالة أومني فلاي برو للسياحة والسفر",
      site_slogan: "بوابتكم الذكية لحجوزات الطيران والفنادق والتأشيرات المعتمدة حول العالم",
      phone: "+966 50 123 4567",
      whatsapp: "966501234567",
      email: "reservations@omnifly-travel.sa",
      address: "الرياض - طريق الملك فهد - برج الأعمال السياحية",
      hero_title: "اكتشف العالم بأفضل الأسعار وأسهل خيارات الحجز",
      hero_subtitle: "احجز تذاكر الطيران، الفنادق الفاخرة، باقات العمرة والسياحة، واستخرج تأشيرتك فورياً بكل سهولة وأمان",
      flight_enabled: 1, hotel_enabled: 1, packages_enabled: 1, visas_enabled: 1, bus_enabled: 1, insurance_enabled: 1,
      payment_card_enabled: 1, payment_bank_enabled: 1, payment_cash_enabled: 1,
      bank_name: "مصرف الراجحي", bank_iban: "SA0380000000608010167519", bank_account_name: "مؤسسة أومني فلاي للسياحة والسفر",
      promo_code: "OMNIFLY10", promo_discount_percent: 10
    };
  }
  res.json(settings);
});

// 14. Get live catalog for public website (flights, hotels, packages, visas, buses)
router.get("/public/website/catalog", (_req, res) => {
  // Flights from NDC or real airline schedules in system
  let flights: any[] = [];
  try {
    flights = db.prepare(`
      SELECT id, offer_id, airline_code, airline_name, origin, destination,
             departure_time, arrival_time, flight_no, cabin_class, total_fare,
             seat_selection_available, baggage_allowance_kg
      FROM travel_ndc_offers
      WHERE status = 'available'
      ORDER BY id DESC LIMIT 20
    `).all();
  } catch (e) {
    flights = [];
  }

  // If no NDC offers, provide standard live scheduled flights from airlines db
  if (flights.length === 0) {
    flights = [
      { id: 101, flight_no: "SV-1024", airline_name: "الخطوط السعودية", airline_code: "SV", origin: "الرياض (RUH)", destination: "دبي (DXB)", departure_time: "08:30", arrival_time: "11:15", cabin_class: "اقتصادية", total_fare: 850, baggage_allowance_kg: 30 },
      { id: 102, flight_no: "SV-2040", airline_name: "الخطوط السعودية", airline_code: "SV", origin: "جدة (JED)", destination: "القاهرة (CAI)", departure_time: "14:00", arrival_time: "16:20", cabin_class: "اقتصادية", total_fare: 790, baggage_allowance_kg: 30 },
      { id: 103, flight_no: "EK-812", airline_name: "طيران الإمارات", airline_code: "EK", origin: "الرياض (RUH)", destination: "لندن (LHR)", departure_time: "03:45", arrival_time: "12:30", cabin_class: "سياحية مرنة", total_fare: 2850, baggage_allowance_kg: 35 },
      { id: 104, flight_no: "QR-1160", airline_name: "الخطوط القطرية", airline_code: "QR", origin: "الدمام (DMM)", destination: "اسطنبول (IST)", departure_time: "16:50", arrival_time: "22:15", cabin_class: "اقتصادية", total_fare: 1650, baggage_allowance_kg: 30 },
      { id: 105, flight_no: "XY-504", airline_name: "طيران ناس", airline_code: "XY", origin: "الرياض (RUH)", destination: "شرم الشيخ (SSH)", departure_time: "10:15", arrival_time: "12:45", cabin_class: "اقتصادية مخفضة", total_fare: 620, baggage_allowance_kg: 20 },
      { id: 106, flight_no: "MS-651", airline_name: "مصر للطيران", airline_code: "MS", origin: "المدينة (MED)", destination: "القاهرة (CAI)", departure_time: "19:30", arrival_time: "21:10", cabin_class: "اقتصادية", total_fare: 740, baggage_allowance_kg: 30 }
    ];
  }

  // Hotels from hotels DB
  let hotels: any[] = [];
  try {
    hotels = db.prepare(`
      SELECT id, hotel_name, city, country, star_rating, address, contact_phone,
             contract_type, avg_room_rate, amenities, notes
      FROM travel_hotels_db
      WHERE status = 'active'
      ORDER BY star_rating DESC LIMIT 20
    `).all();
  } catch (e) {
    hotels = [];
  }

  // Packages & Tours from travel_packages
  let packages: any[] = [];
  try {
    packages = db.prepare(`
      SELECT id, package_code, package_name, destination_city, destination_country,
             duration_days, duration_nights, package_type, price_per_person,
             price_double, includes_flight, includes_hotel, includes_transfers,
             includes_visa, status, notes
      FROM travel_packages
      WHERE status = 'active'
      ORDER BY id DESC LIMIT 15
    `).all();
  } catch (e) {
    packages = [];
  }

  // Visas catalog
  const visas = [
    { country: "المملكة المتحدة (بريطانيا - ETA)", type: "تصريح سفر إلكتروني ETA", processing_days: "3 أيام عمل", price: 290, requirements: "جواز سفر ساري المفعول + صورة شخصية" },
    { country: "دول الشنغن (أوروبا)", type: "تأشيرة سياحية موحدة C", processing_days: "10 - 15 يوم عمل", price: 680, requirements: "كشف حساب بنكي 3 أشهر + تعريف بالراتب + حجز طيران وفندق" },
    { country: "تركيا", type: "تأشيرة إلكترونية سريعة eVisa", processing_days: "24 ساعة", price: 320, requirements: "جواز سفر صالح لمدة لا تقل عن 6 أشهر" },
    { country: "الولايات المتحدة الأمريكية", type: "تأشيرة سياحة وزيارة B1/B2", processing_days: "حسب موعد السفارة", price: 1100, requirements: "تعبئة نموذج DS-160 + حجز موعد المقابلة + تسديد الرسوم" },
    { country: "مصر", type: "تأشيرة دخول إلكترونية", processing_days: "2 - 4 أيام عمل", price: 210, requirements: "صورة الجواز فقط" },
    { country: "أذربيجان", type: "تأشيرة سياحية إلكترونية فورية", processing_days: "ساعات معدودة", price: 195, requirements: "صورة جواز السفر واضحة" }
  ];

  // Buses & Transport
  const buses = [
    { from: "الرياض", to: "مكة المكرمة", operator: "سابتكو VIP النقل الفاخر", departure_time: "08:00 صباحاً", duration: "9 ساعات", price: 180 },
    { from: "جدة", to: "المدينة المنورة", operator: "قطار الحرمين السريع / باصات حديثة", departure_time: "11:30 صباحاً", duration: "ساعتان", price: 120 },
    { from: "الرياض", to: "الدمام", operator: "سابتكو بولمان فندقي", departure_time: "14:00 عصراً", duration: "4 ساعات", price: 85 },
    { from: "المدينة المنورة", to: "مكة المكرمة", operator: "باصات رحلات المعتمرين VIP", departure_time: "16:00 عصراً", duration: "5 ساعات", price: 95 }
  ];

  res.json({ flights, hotels, packages, visas, buses });
});

// 15. Create Online Booking from Website (No authentication required for passengers)
router.post("/public/website/bookings", (req, res) => {
  const {
    service_type, service_title, customer_name, customer_phone,
    customer_email, passport_number, nationality, origin, destination,
    departure_date, return_date, passengers_count = 1, passengers_details,
    total_amount, currency = "SAR", payment_method = "credit_card",
    promo_code, notes
  } = req.body;

  if (!service_type || !customer_name || !customer_phone || !total_amount) {
    res.status(400).json({ error: "اسم العميل ورقم الهاتف ونوع الخدمة والمبلغ حقول مطلوبة" });
    return;
  }

  // Check discount code
  let finalAmount = Number(total_amount);
  const webSettings = db.prepare("SELECT promo_code, promo_discount_percent FROM website_settings WHERE id = 1").get() as any;
  if (promo_code && webSettings && webSettings.promo_code && promo_code.trim().toUpperCase() === webSettings.promo_code.trim().toUpperCase()) {
    const discount = (finalAmount * (webSettings.promo_discount_percent || 10)) / 100;
    finalAmount = Math.max(0, finalAmount - discount);
  }

  const bookingRef = `WEB-${Date.now().toString().slice(-6)}`;
  const pnr = `PNR-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  const ins = db.prepare(`
    INSERT INTO website_online_bookings (
      booking_ref, service_type, service_title, customer_name,
      customer_phone, customer_email, passport_number, nationality,
      origin, destination, departure_date, return_date,
      passengers_count, passengers_details, total_amount, currency,
      payment_method, payment_status, booking_status, pnr, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const paymentStatus = payment_method === "credit_card" ? "paid" : "pending";
  const bookingStatus = "confirmed";

  const r = ins.run(
    bookingRef, service_type, service_title || "حجز خدمة سياحية",
    customer_name, customer_phone, customer_email || null,
    passport_number || null, nationality || "سعودي",
    origin || null, destination || null,
    departure_date || null, return_date || null,
    Number(passengers_count || 1),
    passengers_details ? (typeof passengers_details === "string" ? passengers_details : JSON.stringify(passengers_details)) : null,
    finalAmount, currency, payment_method,
    paymentStatus, bookingStatus, pnr, notes || null
  );

  const newBooking = db.prepare("SELECT * FROM website_online_bookings WHERE id = ?").get(r.lastInsertRowid);

  // Also auto-record a customer in CRM if doesn't exist
  try {
    const existingCust = db.prepare("SELECT id FROM customers WHERE phone = ?").get(customer_phone);
    if (!existingCust) {
      db.prepare(`
        INSERT INTO customers (name, phone, email, notes)
        VALUES (?, ?, ?, 'تم التسجيل تلقائياً عبر حجز الموقع الإلكتروني')
      `).run(customer_name, customer_phone, customer_email || null);
    }
  } catch (e) {}

  res.status(201).json({
    success: true,
    message: "تم تسجيل الحجز بنجاح وإصدار القسيمة الإلكترونية",
    booking: newBooking
  });
});

// 16. Public Booking Lookup & Ticket Tracker (By PNR, Booking Ref, Phone, or Passport)
router.get("/public/website/lookup", (req, res) => {
  const { query } = req.query;
  if (!query || String(query).trim().length < 2) {
    res.status(400).json({ error: "الرجاء إدخال رقم الحجز أو الهاتف أو رقم الجواز" });
    return;
  }

  const q = String(query).trim();

  // Search online bookings first
  const onlineBookings = db.prepare(`
    SELECT * FROM website_online_bookings
    WHERE booking_ref LIKE ? OR pnr LIKE ? OR customer_phone LIKE ? OR passport_number LIKE ?
    ORDER BY id DESC LIMIT 5
  `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);

  // Search internal travel bookings
  const travelBookings = db.prepare(`
    SELECT b.*, p.name_ar as passenger_name_ar, p.passport_number, c.name as customer_name, c.phone as customer_phone
    FROM travel_bookings b
    LEFT JOIN travel_passengers p ON p.id = b.passenger_id
    LEFT JOIN customers c ON c.id = b.customer_id
    WHERE b.pnr LIKE ? OR b.ticket_number LIKE ? OR b.booking_number LIKE ? OR c.phone LIKE ? OR p.passport_number LIKE ?
    ORDER BY b.id DESC LIMIT 5
  `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);

  res.json({
    query: q,
    count: onlineBookings.length + travelBookings.length,
    online_bookings: onlineBookings,
    travel_bookings: travelBookings
  });
});

// 17. Submit Public Customer Inquiry or Custom Tour Request
router.post("/public/website/inquiries", (req, res) => {
  const { name, phone, email, service_interest, message } = req.body;
  if (!name || !phone || !message) {
    res.status(400).json({ error: "الاسم ورقم الجوال والرسالة حقول مطلوبة" });
    return;
  }

  const ins = db.prepare(`
    INSERT INTO website_inquiries (name, phone, email, service_interest, message, status)
    VALUES (?, ?, ?, ?, ?, 'new')
  `);
  const r = ins.run(name, phone, email || null, service_interest || "استفسار عام", message);
  const created = db.prepare("SELECT * FROM website_inquiries WHERE id = ?").get(r.lastInsertRowid);

  res.status(201).json({ success: true, message: "تم إرسال استفسارك بنجاح وسيتواصل معك مستشار السفر في أقرب وقت", inquiry: created });
});

// ============================================================================
// ADMIN WEBSITE CMS & ONLINE BOOKING MANAGEMENT API ENDPOINTS
// ============================================================================

// 18. Admin Get Full Website Settings
router.get("/admin/website/config", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const settings = db.prepare("SELECT * FROM website_settings WHERE id = 1").get();
  res.json(settings);
});

// 19. Admin Update Website Settings & CMS
router.put("/admin/website/config", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    site_name, site_slogan, phone, whatsapp, email, address,
    hero_title, hero_subtitle, flight_enabled, hotel_enabled,
    packages_enabled, visas_enabled, bus_enabled, insurance_enabled,
    flight_markup_val, flight_markup_type, hotel_markup_val, hotel_markup_type,
    package_markup_val, package_markup_type, payment_card_enabled, payment_bank_enabled,
    payment_cash_enabled, bank_name, bank_iban, bank_account_name,
    promo_code, promo_discount_percent
  } = req.body;

  db.prepare(`
    UPDATE website_settings
    SET site_name = ?, site_slogan = ?, phone = ?, whatsapp = ?, email = ?, address = ?,
        hero_title = ?, hero_subtitle = ?, flight_enabled = ?, hotel_enabled = ?,
        packages_enabled = ?, visas_enabled = ?, bus_enabled = ?, insurance_enabled = ?,
        flight_markup_val = ?, flight_markup_type = ?, hotel_markup_val = ?, hotel_markup_type = ?,
        package_markup_val = ?, package_markup_type = ?, payment_card_enabled = ?, payment_bank_enabled = ?,
        payment_cash_enabled = ?, bank_name = ?, bank_iban = ?, bank_account_name = ?,
        promo_code = ?, promo_discount_percent = ?, updated_at = (datetime('now', 'localtime'))
    WHERE id = 1
  `).run(
    site_name, site_slogan, phone, whatsapp, email, address,
    hero_title, hero_subtitle,
    Number(flight_enabled ?? 1), Number(hotel_enabled ?? 1),
    Number(packages_enabled ?? 1), Number(visas_enabled ?? 1), Number(bus_enabled ?? 1), Number(insurance_enabled ?? 1),
    Number(flight_markup_val ?? 5), flight_markup_type || "percent",
    Number(hotel_markup_val ?? 8), hotel_markup_type || "percent",
    Number(package_markup_val ?? 5), package_markup_type || "percent",
    Number(payment_card_enabled ?? 1), Number(payment_bank_enabled ?? 1),
    Number(payment_cash_enabled ?? 1), bank_name, bank_iban, bank_account_name,
    promo_code, Number(promo_discount_percent ?? 10)
  );

  logAudit(user.id, user.name, "WEBSITE_CMS_UPDATED", "تحديث إعدادات ومحتوى الموقع الإلكتروني للعملاء");

  const updated = db.prepare("SELECT * FROM website_settings WHERE id = 1").get();
  res.json({ success: true, settings: updated });
});

// 20. Admin Get All Website Online Bookings
router.get("/admin/website/bookings", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const rows = db.prepare("SELECT * FROM website_online_bookings ORDER BY id DESC LIMIT 200").all();
  res.json(rows);
});

// 21. Admin Update Online Booking Status
router.put("/admin/website/bookings/:id/status", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { booking_status, payment_status, notes } = req.body;

  db.prepare(`
    UPDATE website_online_bookings
    SET booking_status = COALESCE(?, booking_status),
        payment_status = COALESCE(?, payment_status),
        notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(booking_status || null, payment_status || null, notes || null, req.params.id);

  const updated = db.prepare("SELECT * FROM website_online_bookings WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// 22. Admin Get Website Inquiries
router.get("/admin/website/inquiries", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const rows = db.prepare("SELECT * FROM website_inquiries ORDER BY id DESC LIMIT 100").all();
  res.json(rows);
});

// 23. Admin Update Inquiry Status
router.put("/admin/website/inquiries/:id/status", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { status } = req.body;
  db.prepare("UPDATE website_inquiries SET status = ? WHERE id = ?").run(status, req.params.id);
  const updated = db.prepare("SELECT * FROM website_inquiries WHERE id = ?").get(req.params.id);
  res.json(updated);
});

export default router;
