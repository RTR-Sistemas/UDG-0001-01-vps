import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

type GenericRecord = Record<string, unknown>;

type OpenGenericTable = {
  Row: GenericRecord;
  Insert: GenericRecord;
  Update: GenericRecord;
  Relationships: Array<{
    foreignKeyName: string;
    columns: Array<string>;
    referencedRelation: string;
    referencedColumns: Array<string>;
    isOneToOne: boolean;
  }>;
};

type OpenGenericFunction = {
  Args: GenericRecord;
  Returns: GenericRecord | null;
};

type OpenPublicSchema = {
  Tables: Record<string, OpenGenericTable>;
  Views: Record<string, never>;
  Functions: Record<string, OpenGenericFunction>;
};

type OpenDatabase = {
  public: OpenPublicSchema;
};

type OpenClient = SupabaseClient<OpenDatabase, "public">;

export const openDb = supabase as unknown as OpenClient;