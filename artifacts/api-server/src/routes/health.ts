import { Router, type IRouter } from "express";
import { getPostgresPersistenceStatus } from "../lib/pg-persistence";

const router: IRouter = Router();

router.get(["/healthz", "/health"], (_req, res) => {
  res.json({
    status: "ok",
    database: {
      internal: "sqlite-wal",
      externalPostgres: getPostgresPersistenceStatus(),
    },
  });
});

export default router;
