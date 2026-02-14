import { z } from "zod";

// --- Scalar value schemas (extract the primary scalar from each value type) ---

const textValueSchema = z.object({ value: z.string() }).passthrough();
type TextValue = z.infer<typeof textValueSchema>;

const numberValueSchema = z.object({ value: z.number() }).passthrough();
type NumberValue = z.infer<typeof numberValueSchema>;

const checkboxValueSchema = z.object({ value: z.boolean() }).passthrough();
type CheckboxValue = z.infer<typeof checkboxValueSchema>;

const dateValueSchema = z
  .object({ value: z.string(), attribute_type: z.literal("date").optional() })
  .passthrough();
type DateValue = z.infer<typeof dateValueSchema>;

const timestampValueSchema = z
  .object({
    value: z.string(),
    attribute_type: z.literal("timestamp").optional(),
  })
  .passthrough();
type TimestampValue = z.infer<typeof timestampValueSchema>;

const ratingValueSchema = z
  .object({ value: z.number().min(0).max(5) })
  .passthrough();
type RatingValue = z.infer<typeof ratingValueSchema>;

const currencyValueSchema = z
  .object({
    currency_value: z.number(),
    currency_code: z.string().optional(),
  })
  .passthrough();
type CurrencyValue = z.infer<typeof currencyValueSchema>;

const domainValueSchema = z
  .object({ domain: z.string(), root_domain: z.string().optional() })
  .passthrough();
type DomainValue = z.infer<typeof domainValueSchema>;

const emailValueSchema = z
  .object({
    original_email_address: z.string(),
    email_address: z.string(),
    email_domain: z.string().optional(),
    email_root_domain: z.string().optional(),
    email_local_specifier: z.string().optional(),
  })
  .passthrough();
type EmailValue = z.infer<typeof emailValueSchema>;

const phoneValueSchema = z
  .object({
    original_phone_number: z.string(),
    phone_number: z.string(),
    country_code: z.string().optional(),
  })
  .passthrough();
type PhoneValue = z.infer<typeof phoneValueSchema>;

const personalNameValueSchema = z
  .object({
    first_name: z.string(),
    last_name: z.string(),
    full_name: z.string(),
  })
  .passthrough();
type PersonalNameValue = z.infer<typeof personalNameValueSchema>;

const locationValueSchema = z
  .object({
    line_1: z.string().nullable(),
    line_2: z.string().nullable(),
    line_3: z.string().nullable(),
    line_4: z.string().nullable(),
    locality: z.string().nullable(),
    region: z.string().nullable(),
    postcode: z.string().nullable(),
    country_code: z.string().nullable(),
    latitude: z.string().nullable(),
    longitude: z.string().nullable(),
  })
  .passthrough();
type LocationValue = z.infer<typeof locationValueSchema>;

const recordReferenceValueSchema = z
  .object({
    target_object: z.string(),
    target_record_id: z.string(),
  })
  .passthrough();
type RecordReferenceValue = z.infer<typeof recordReferenceValueSchema>;

const actorReferenceValueSchema = z
  .object({
    referenced_actor_type: z.enum([
      "api-token",
      "workspace-member",
      "system",
      "app",
    ]),
    referenced_actor_id: z.string().nullable(),
  })
  .passthrough();
type ActorReferenceValue = z.infer<typeof actorReferenceValueSchema>;

const interactionValueSchema = z
  .object({
    interaction_type: z.enum([
      "calendar-event",
      "call",
      "chat-thread",
      "email",
      "in-person-meeting",
      "meeting",
    ]),
    interacted_at: z.string(),
    owner_actor: z
      .object({
        id: z.string().optional(),
        type: z
          .enum(["api-token", "workspace-member", "system", "app"])
          .optional(),
      })
      .passthrough(),
  })
  .passthrough();
type InteractionValue = z.infer<typeof interactionValueSchema>;

// --- Enriched object schemas for select/status (API returns these when hydrated) ---

const selectOptionObjectSchema = z.object({ title: z.string() }).passthrough();

const selectValueSchema = z
  .object({ option: z.union([z.string(), selectOptionObjectSchema]) })
  .passthrough();
type SelectValue = z.infer<typeof selectValueSchema>;

const enrichedSelectValueSchema = z
  .object({ option: selectOptionObjectSchema })
  .passthrough();
type EnrichedSelectValue = z.infer<typeof enrichedSelectValueSchema>;

const statusObjectSchema = z.object({ title: z.string() }).passthrough();

const statusValueSchema = z
  .object({ status: z.union([z.string(), statusObjectSchema]) })
  .passthrough();
type StatusValue = z.infer<typeof statusValueSchema>;

const enrichedStatusValueSchema = z
  .object({ status: statusObjectSchema })
  .passthrough();
type EnrichedStatusValue = z.infer<typeof enrichedStatusValueSchema>;

// --- Lookup table mapping attribute_type to its schema ---

const valueSchemasByType = {
  text: textValueSchema,
  number: numberValueSchema,
  checkbox: checkboxValueSchema,
  date: dateValueSchema,
  timestamp: timestampValueSchema,
  rating: ratingValueSchema,
  currency: currencyValueSchema,
  domain: domainValueSchema,
  "email-address": emailValueSchema,
  "phone-number": phoneValueSchema,
  "personal-name": personalNameValueSchema,
  location: locationValueSchema,
  "record-reference": recordReferenceValueSchema,
  "actor-reference": actorReferenceValueSchema,
  interaction: interactionValueSchema,
  select: selectValueSchema,
  status: statusValueSchema,
} as const;

type ValueAttributeType = keyof typeof valueSchemasByType;

export {
  actorReferenceValueSchema,
  checkboxValueSchema,
  currencyValueSchema,
  dateValueSchema,
  domainValueSchema,
  emailValueSchema,
  enrichedSelectValueSchema,
  enrichedStatusValueSchema,
  interactionValueSchema,
  locationValueSchema,
  numberValueSchema,
  personalNameValueSchema,
  phoneValueSchema,
  ratingValueSchema,
  recordReferenceValueSchema,
  selectOptionObjectSchema,
  selectValueSchema,
  statusObjectSchema,
  statusValueSchema,
  textValueSchema,
  timestampValueSchema,
  valueSchemasByType,
};

export type {
  ActorReferenceValue,
  CheckboxValue,
  CurrencyValue,
  DateValue,
  DomainValue,
  EmailValue,
  EnrichedSelectValue,
  EnrichedStatusValue,
  InteractionValue,
  LocationValue,
  NumberValue,
  PersonalNameValue,
  PhoneValue,
  RatingValue,
  RecordReferenceValue,
  SelectValue,
  StatusValue,
  TextValue,
  TimestampValue,
  ValueAttributeType,
};
