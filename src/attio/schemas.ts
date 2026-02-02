import { z } from "zod";

export const rawRecordSchema = z.record(z.string(), z.unknown());
