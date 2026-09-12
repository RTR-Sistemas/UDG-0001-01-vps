export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      account_security_keys: {
        Row: {
          created_at: string
          security_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          security_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          security_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_security_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      age_verification_log: {
        Row: {
          created_at: string
          id: string
          provider: string | null
          result: Json | null
          session_id: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          provider?: string | null
          result?: Json | null
          session_id?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          provider?: string | null
          result?: Json | null
          session_id?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "age_verification_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_rejections_log: {
        Row: {
          bombs: number
          hearts: number
          id: string
          post_id: string | null
          post_user_id: string | null
          rejected_at: string
        }
        Insert: {
          bombs?: number
          hearts?: number
          id?: string
          post_id?: string | null
          post_user_id?: string | null
          rejected_at?: string
        }
        Update: {
          bombs?: number
          hearts?: number
          id?: string
          post_id?: string | null
          post_user_id?: string | null
          rejected_at?: string
        }
        Relationships: []
      }
      arena_stats: {
        Row: {
          created_at: string | null
          id: string
          last_updated: string | null
          total_approved: number
          total_in_voting: number
          total_processed: number
          total_rejected: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_updated?: string | null
          total_approved?: number
          total_in_voting?: number
          total_processed?: number
          total_rejected?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          last_updated?: string | null
          total_approved?: number
          total_in_voting?: number
          total_processed?: number
          total_rejected?: number
        }
        Relationships: []
      }
      attention_call_limits: {
        Row: {
          created_at: string
          id: string
          last_call_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_call_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_call_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attention_call_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attention_calls: {
        Row: {
          created_at: string
          id: string
          message: string | null
          receiver_id: string
          sender_id: string
          viewed_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          receiver_id: string
          sender_id: string
          viewed_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          receiver_id?: string
          sender_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attention_calls_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attention_calls_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attention_silence_settings: {
        Row: {
          created_at: string
          id: string
          sender_id: string
          silenced_until: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sender_id: string
          silenced_until: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sender_id?: string
          silenced_until?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attention_silence_settings_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attention_silence_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          resource_id: string | null
          resource_type: string | null
          status: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          status?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          status?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      battle_extensions: {
        Row: {
          approved_by: string | null
          battle_id: string
          created_at: string
          extra_seconds: number
          id: string
          requested_by: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          battle_id: string
          created_at?: string
          extra_seconds?: number
          id?: string
          requested_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          battle_id?: string
          created_at?: string
          extra_seconds?: number
          id?: string
          requested_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "battle_extensions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_extensions_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_extensions_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_participants: {
        Row: {
          battle_id: string
          created_at: string
          gift_count: number
          id: string
          last_gift_at: string | null
          total_coins_spent: number
          user_id: string
        }
        Insert: {
          battle_id: string
          created_at?: string
          gift_count?: number
          id?: string
          last_gift_at?: string | null
          total_coins_spent?: number
          user_id: string
        }
        Update: {
          battle_id?: string
          created_at?: string
          gift_count?: number
          id?: string
          last_gift_at?: string | null
          total_coins_spent?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "battle_participants_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      battles: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          created_at: string
          duration_seconds: number
          extension_count: number
          guest_id: string
          guest_score: number
          host_id: string
          host_score: number
          id: string
          scheduled_start: string | null
          status: string
          total_coins_spent: number
          total_gifts_sent: number
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string
          duration_seconds?: number
          extension_count?: number
          guest_id: string
          guest_score?: number
          host_id: string
          host_score?: number
          id?: string
          scheduled_start?: string | null
          status?: string
          total_coins_spent?: number
          total_gifts_sent?: number
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string
          duration_seconds?: number
          extension_count?: number
          guest_id?: string
          guest_score?: number
          host_id?: string
          host_score?: number
          id?: string
          scheduled_start?: string | null
          status?: string
          total_coins_spent?: number
          total_gifts_sent?: number
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "battles_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battles_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battles_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          agora_channel_name: string
          caller_id: string
          created_at: string
          id: string
          receiver_id: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          agora_channel_name: string
          caller_id: string
          created_at?: string
          id?: string
          receiver_id: string
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          agora_channel_name?: string
          caller_id?: string
          created_at?: string
          id?: string
          receiver_id?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_caller_id_fkey"
            columns: ["caller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_purchase_orders: {
        Row: {
          amount_coins: number
          created_at: string
          currency: string
          gateway_transaction_id: string | null
          id: string
          paid_at: string | null
          payment_gateway: string
          price: number
          status: string
          user_id: string
        }
        Insert: {
          amount_coins: number
          created_at?: string
          currency?: string
          gateway_transaction_id?: string | null
          id?: string
          paid_at?: string | null
          payment_gateway?: string
          price?: number
          status?: string
          user_id: string
        }
        Update: {
          amount_coins?: number
          created_at?: string
          currency?: string
          gateway_transaction_id?: string | null
          id?: string
          paid_at?: string | null
          payment_gateway?: string
          price?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coin_purchase_orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          avatar_url: string | null
          cover_url: string | null
          created_at: string
          created_by: string
          custom_accent: string | null
          custom_background: string | null
          custom_color: string | null
          custom_font: string | null
          description: string | null
          id: string
          is_private: boolean
          name: string
          password_hash: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          cover_url?: string | null
          created_at?: string
          created_by: string
          custom_accent?: string | null
          custom_background?: string | null
          custom_color?: string | null
          custom_font?: string | null
          description?: string | null
          id?: string
          is_private?: boolean
          name: string
          password_hash?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string
          custom_accent?: string | null
          custom_background?: string | null
          custom_color?: string | null
          custom_font?: string | null
          description?: string | null
          id?: string
          is_private?: boolean
          name?: string
          password_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_members: {
        Row: {
          community_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          community_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          community_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          community_id: string
          content: string | null
          created_at: string
          id: string
          media_urls: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          community_id: string
          content?: string | null
          created_at?: string
          id?: string
          media_urls?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          community_id?: string
          content?: string | null
          created_at?: string
          id?: string
          media_urls?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_moderation_log: {
        Row: {
          action_taken: string | null
          auto_blocked: boolean | null
          content_type: string
          created_at: string | null
          flagged_labels: Json | null
          id: string
          is_published: boolean | null
          media_url: string | null
          post_id: string | null
          severity: string | null
          text_content: string | null
          user_id: string | null
        }
        Insert: {
          action_taken?: string | null
          auto_blocked?: boolean | null
          content_type: string
          created_at?: string | null
          flagged_labels?: Json | null
          id?: string
          is_published?: boolean | null
          media_url?: string | null
          post_id?: string | null
          severity?: string | null
          text_content?: string | null
          user_id?: string | null
        }
        Update: {
          action_taken?: string | null
          auto_blocked?: boolean | null
          content_type?: string
          created_at?: string | null
          flagged_labels?: Json | null
          id?: string
          is_published?: boolean | null
          media_url?: string | null
          post_id?: string | null
          severity?: string | null
          text_content?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_moderation_log_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_moderation_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          added_by: string | null
          conversation_id: string
          id: string
          joined_at: string
          nickname: string | null
          role: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          conversation_id: string
          id?: string
          joined_at?: string
          nickname?: string | null
          role?: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          conversation_id?: string
          id?: string
          joined_at?: string
          nickname?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_save_mode: {
        Row: {
          conversation_id: string
          created_at: string
          deactivated_at: string | null
          id: string
          owner_id: string
          requester_id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          deactivated_at?: string | null
          id?: string
          owner_id: string
          requester_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          deactivated_at?: string | null
          id?: string
          owner_id?: string
          requester_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_save_mode_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_save_mode_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_save_mode_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          auto_translate: boolean | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          group_avatar: string | null
          group_description: string | null
          id: string
          is_group: boolean
          is_temporary: boolean | null
          max_participants: number | null
          name: string | null
          pinned: boolean | null
        }
        Insert: {
          auto_translate?: boolean | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          group_avatar?: string | null
          group_description?: string | null
          id?: string
          is_group?: boolean
          is_temporary?: boolean | null
          max_participants?: number | null
          name?: string | null
          pinned?: boolean | null
        }
        Update: {
          auto_translate?: boolean | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          group_avatar?: string | null
          group_description?: string | null
          id?: string
          is_group?: boolean
          is_temporary?: boolean | null
          max_participants?: number | null
          name?: string | null
          pinned?: boolean | null
        }
        Relationships: []
      }
      daily_answers: {
        Row: {
          answer: string
          created_at: string
          id: string
          question_id: string
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          question_id: string
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "daily_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_answers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_questions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          question: string
          question_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          question: string
          question_date: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          question?: string
          question_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_questions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_questions_pool: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          last_used_date: string | null
          question: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_used_date?: string | null
          question: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_used_date?: string | null
          question?: string
        }
        Relationships: []
      }
      debate_chat: {
        Row: {
          created_at: string
          debate_id: string
          id: string
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string
          debate_id: string
          id?: string
          message: string
          user_id: string
        }
        Update: {
          created_at?: string
          debate_id?: string
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debate_chat_debate_id_fkey"
            columns: ["debate_id"]
            isOneToOne: false
            referencedRelation: "debates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debate_chat_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      debate_recordings: {
        Row: {
          created_at: string
          debate_id: string
          duration_seconds: number
          id: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          debate_id: string
          duration_seconds?: number
          id?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          debate_id?: string
          duration_seconds?: number
          id?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debate_recordings_debate_id_fkey"
            columns: ["debate_id"]
            isOneToOne: false
            referencedRelation: "debates"
            referencedColumns: ["id"]
          },
        ]
      }
      debate_votes: {
        Row: {
          created_at: string | null
          debate_id: string | null
          id: string
          user_id: string | null
          vote_for_id: string | null
        }
        Insert: {
          created_at?: string | null
          debate_id?: string | null
          id?: string
          user_id?: string | null
          vote_for_id?: string | null
        }
        Update: {
          created_at?: string | null
          debate_id?: string | null
          id?: string
          user_id?: string | null
          vote_for_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debate_votes_debate_id_fkey"
            columns: ["debate_id"]
            isOneToOne: false
            referencedRelation: "debates"
            referencedColumns: ["id"]
          },
        ]
      }
      debates: {
        Row: {
          agora_channel_name: string | null
          category: string | null
          created_at: string
          current_phase: string | null
          description: string | null
          ended_at: string | null
          guest_id: string
          host_id: string
          id: string
          phase_ends_at: string | null
          ready_guest: boolean
          ready_host: boolean
          status: Database["public"]["Enums"]["debate_status"]
          title: string | null
          topic: string | null
          updated_at: string
          video_url: string | null
          viewers: number
          votes_guest: number
          votes_host: number
          winner_id: string | null
        }
        Insert: {
          agora_channel_name?: string | null
          category?: string | null
          created_at?: string
          current_phase?: string | null
          description?: string | null
          ended_at?: string | null
          guest_id: string
          host_id: string
          id?: string
          phase_ends_at?: string | null
          ready_guest?: boolean
          ready_host?: boolean
          status?: Database["public"]["Enums"]["debate_status"]
          title?: string | null
          topic?: string | null
          updated_at?: string
          video_url?: string | null
          viewers?: number
          votes_guest?: number
          votes_host?: number
          winner_id?: string | null
        }
        Update: {
          agora_channel_name?: string | null
          category?: string | null
          created_at?: string
          current_phase?: string | null
          description?: string | null
          ended_at?: string | null
          guest_id?: string
          host_id?: string
          id?: string
          phase_ends_at?: string | null
          ready_guest?: boolean
          ready_host?: boolean
          status?: Database["public"]["Enums"]["debate_status"]
          title?: string | null
          topic?: string | null
          updated_at?: string
          video_url?: string | null
          viewers?: number
          votes_guest?: number
          votes_host?: number
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debates_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debates_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deleted_messages_archive: {
        Row: {
          admin_notes: string | null
          content: string | null
          conversation_id: string
          deleted_at: string
          deleted_by: string
          deletion_context: string | null
          id: string
          media_urls: string[] | null
          original_created_at: string
          original_message_id: string
          reviewed_at: string | null
          reviewed_by_admin: string | null
          sender_id: string
        }
        Insert: {
          admin_notes?: string | null
          content?: string | null
          conversation_id: string
          deleted_at?: string
          deleted_by: string
          deletion_context?: string | null
          id?: string
          media_urls?: string[] | null
          original_created_at: string
          original_message_id: string
          reviewed_at?: string | null
          reviewed_by_admin?: string | null
          sender_id: string
        }
        Update: {
          admin_notes?: string | null
          content?: string | null
          conversation_id?: string
          deleted_at?: string
          deleted_by?: string
          deletion_context?: string | null
          id?: string
          media_urls?: string[] | null
          original_created_at?: string
          original_message_id?: string
          reviewed_at?: string | null
          reviewed_by_admin?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deleted_messages_archive_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deleted_messages_archive_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deleted_messages_archive_reviewed_by_admin_fkey"
            columns: ["reviewed_by_admin"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deleted_messages_archive_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      family_requests: {
        Row: {
          created_at: string
          id: string
          receiver_id: string
          relation_type: string
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_id: string
          relation_type: string
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_id?: string
          relation_type?: string
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_requests_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      followers: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followers_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followers_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_requests: {
        Row: {
          created_at: string
          id: string
          receiver_id: string
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_id: string
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_transactions: {
        Row: {
          battle_id: string | null
          coins_spent: number
          created_at: string
          diamonds_earned: number
          gift_id: string
          id: string
          is_battle_gift: boolean
          platform_fee: number
          quantity: number
          receiver_id: string
          sender_id: string
        }
        Insert: {
          battle_id?: string | null
          coins_spent: number
          created_at?: string
          diamonds_earned: number
          gift_id: string
          id?: string
          is_battle_gift?: boolean
          platform_fee?: number
          quantity?: number
          receiver_id: string
          sender_id: string
        }
        Update: {
          battle_id?: string | null
          coins_spent?: number
          created_at?: string
          diamonds_earned?: number
          gift_id?: string
          id?: string
          is_battle_gift?: boolean
          platform_fee?: number
          quantity?: number
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_transactions_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_transactions_gift_id_fkey"
            columns: ["gift_id"]
            isOneToOne: false
            referencedRelation: "gifts_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_transactions_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_transactions_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gifts_catalog: {
        Row: {
          coin_cost: number
          created_at: string
          description: string | null
          diamond_value: number
          emoji: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_animated: boolean
          name: string
          sort_order: number
        }
        Insert: {
          coin_cost: number
          created_at?: string
          description?: string | null
          diamond_value: number
          emoji?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_animated?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          coin_cost?: number
          created_at?: string
          description?: string | null
          diamond_value?: number
          emoji?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_animated?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      grampo_sessions: {
        Row: {
          conversation_id: string
          created_at: string
          duration_seconds: number
          ended_at: string | null
          id: string
          requester_id: string
          started_at: string | null
          status: string
          target_id: string
          updated_at: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          requester_id: string
          started_at?: string | null
          status?: string
          target_id: string
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          requester_id?: string
          started_at?: string | null
          status?: string
          target_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grampo_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grampo_sessions_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grampo_sessions_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      last_viewed: {
        Row: {
          id: string
          section: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          section: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          section?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mentions: {
        Row: {
          content_id: string
          content_type: string
          created_at: string | null
          id: string
          is_read: boolean | null
          mentioned_user_id: string
          user_id: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          mentioned_user_id: string
          user_id: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          mentioned_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      mesh_keys: {
        Row: {
          public_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          public_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          public_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mesh_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mesh_message_queue: {
        Row: {
          content: string | null
          conversation_id: string | null
          created_at: string
          delivered_at: string | null
          id: string
          media_urls: string[] | null
          priority: string | null
          receiver_id: string | null
          route_taken: Json | null
          sender_id: string | null
          status: string | null
          ttl: number | null
        }
        Insert: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          media_urls?: string[] | null
          priority?: string | null
          receiver_id?: string | null
          route_taken?: Json | null
          sender_id?: string | null
          status?: string | null
          ttl?: number | null
        }
        Update: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          media_urls?: string[] | null
          priority?: string | null
          receiver_id?: string | null
          route_taken?: Json | null
          sender_id?: string | null
          status?: string | null
          ttl?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mesh_message_queue_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mesh_message_queue_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mesh_message_queue_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mesh_relay_messages: {
        Row: {
          conversation_id: string | null
          created_at: string
          delivered_at: string | null
          encrypted_content: string
          gateway_id: string | null
          id: string
          receiver_id: string
          sender_id: string
          size_bytes: number
          status: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          encrypted_content: string
          gateway_id?: string | null
          id?: string
          receiver_id: string
          sender_id: string
          size_bytes?: number
          status?: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          encrypted_content?: string
          gateway_id?: string | null
          id?: string
          receiver_id?: string
          sender_id?: string
          size_bytes?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mesh_relay_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mesh_relay_messages_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mesh_relay_messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mesh_relay_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_deletions_user: {
        Row: {
          conversation_id: string
          deleted_at: string
          deleted_by: string
          id: string
          message_id: string
          original_content: string | null
          original_language: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          deleted_at?: string
          deleted_by?: string
          id?: string
          message_id: string
          original_content?: string | null
          original_language?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          deleted_at?: string
          deleted_by?: string
          id?: string
          message_id?: string
          original_content?: string | null
          original_language?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_deletions_user_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deletions_user_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deletions_user_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_translations: {
        Row: {
          created_at: string
          dubbing_method: string | null
          error_message: string | null
          id: string
          message_id: string | null
          original_audio_url: string | null
          original_language: string | null
          original_text: string | null
          target_language: string | null
          translated_audio_url: string | null
          translated_text: string | null
          translation_status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dubbing_method?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          original_audio_url?: string | null
          original_language?: string | null
          original_text?: string | null
          target_language?: string | null
          translated_audio_url?: string | null
          translated_text?: string | null
          translation_status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dubbing_method?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          original_audio_url?: string | null
          original_language?: string | null
          original_text?: string | null
          target_language?: string | null
          translated_audio_url?: string | null
          translated_text?: string | null
          translation_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_translations_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          detected_language: string | null
          edited_at: string | null
          expires_at: string | null
          id: string
          is_deleted: boolean
          is_edited: boolean
          is_pq_encrypted: boolean | null
          media_urls: string[] | null
          pq_signature: string | null
          updated_at: string
          user_id: string
          via_mesh: boolean
          viewed_at: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          detected_language?: string | null
          edited_at?: string | null
          expires_at?: string | null
          id?: string
          is_deleted?: boolean
          is_edited?: boolean
          is_pq_encrypted?: boolean | null
          media_urls?: string[] | null
          pq_signature?: string | null
          updated_at?: string
          user_id: string
          via_mesh?: boolean
          viewed_at?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          detected_language?: string | null
          edited_at?: string | null
          expires_at?: string | null
          id?: string
          is_deleted?: boolean
          is_edited?: boolean
          is_pq_encrypted?: boolean | null
          media_urls?: string[] | null
          pq_signature?: string | null
          updated_at?: string
          user_id?: string
          via_mesh?: boolean
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mood_daily_limits: {
        Row: {
          count: number
          day: string
          updated_at: string
          user_id: string
        }
        Insert: {
          count?: number
          day: string
          updated_at?: string
          user_id: string
        }
        Update: {
          count?: number
          day?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mood_daily_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mood_daily_prompts: {
        Row: {
          dismissed: boolean
          prompted_date: string
          responded: boolean
          responded_at: string | null
          user_id: string
        }
        Insert: {
          dismissed?: boolean
          prompted_date: string
          responded?: boolean
          responded_at?: string | null
          user_id: string
        }
        Update: {
          dismissed?: boolean
          prompted_date?: string
          responded?: boolean
          responded_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mood_daily_prompts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mood_history: {
        Row: {
          analysis_source: string | null
          confidence: number | null
          context: Json | null
          created_at: string
          details: Json | null
          emoji: string | null
          id: string
          intensity: number | null
          mood: string
          secondary_intensity: number | null
          secondary_mood: string | null
          user_id: string
        }
        Insert: {
          analysis_source?: string | null
          confidence?: number | null
          context?: Json | null
          created_at?: string
          details?: Json | null
          emoji?: string | null
          id?: string
          intensity?: number | null
          mood: string
          secondary_intensity?: number | null
          secondary_mood?: string | null
          user_id: string
        }
        Update: {
          analysis_source?: string | null
          confidence?: number | null
          context?: Json | null
          created_at?: string
          details?: Json | null
          emoji?: string | null
          id?: string
          intensity?: number | null
          mood?: string
          secondary_intensity?: number | null
          secondary_mood?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mood_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          attention_calls: boolean
          badge_enabled: boolean
          comment_replies: boolean
          comments: boolean
          communities: boolean
          created_at: string
          friend_requests: boolean
          mentions: boolean
          messages: boolean
          posts: boolean
          push_enabled: boolean
          relationships: boolean
          sound_enabled: boolean
          system_alerts: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          attention_calls?: boolean
          badge_enabled?: boolean
          comment_replies?: boolean
          comments?: boolean
          communities?: boolean
          created_at?: string
          friend_requests?: boolean
          mentions?: boolean
          messages?: boolean
          posts?: boolean
          push_enabled?: boolean
          relationships?: boolean
          sound_enabled?: boolean
          system_alerts?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          attention_calls?: boolean
          badge_enabled?: boolean
          comment_replies?: boolean
          comments?: boolean
          communities?: boolean
          created_at?: string
          friend_requests?: boolean
          mentions?: boolean
          messages?: boolean
          posts?: boolean
          push_enabled?: boolean
          relationships?: boolean
          sound_enabled?: boolean
          system_alerts?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          data: Json | null
          expires_at: string | null
          id: string
          is_muted: boolean | null
          is_read: boolean | null
          message: string
          metadata: Json | null
          target_id: string | null
          target_type: string | null
          target_user_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          expires_at?: string | null
          id?: string
          is_muted?: boolean | null
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          target_user_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          expires_at?: string | null
          id?: string
          is_muted?: boolean | null
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          target_user_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      poll_options: {
        Row: {
          id: string
          poll_id: string
          position: number
          text: string
        }
        Insert: {
          id?: string
          poll_id: string
          position?: number
          text: string
        }
        Update: {
          id?: string
          poll_id?: string
          position?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          option_id: string
          poll_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          poll_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          poll_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_anonymous: boolean
          message_id: string
          question: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_anonymous?: boolean
          message_id: string
          question: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_anonymous?: boolean
          message_id?: string
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      post_shares: {
        Row: {
          created_at: string | null
          id: string
          metadata: Json | null
          platform: string
          post_id: string | null
          shared_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          platform: string
          post_id?: string | null
          shared_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          platform?: string
          post_id?: string | null
          shared_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_votes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
          vote_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
          vote_type: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          audio_url: string | null
          blocked_reason: string | null
          boost_until: string | null
          content: string | null
          created_at: string
          id: string
          is_blocked: boolean
          is_community_approved: boolean | null
          media_urls: string[] | null
          mood_at_post: string | null
          mood_emoji_at_post: string | null
          mood_public_at_post: boolean
          mood_status_enabled_at_post: boolean
          movement_status_at_post: string | null
          movement_status_enabled_at_post: boolean
          post_type: string | null
          updated_at: string
          user_id: string
          voting_ends_at: string | null
          voting_period_active: boolean | null
        }
        Insert: {
          audio_url?: string | null
          blocked_reason?: string | null
          boost_until?: string | null
          content?: string | null
          created_at?: string
          id?: string
          is_blocked?: boolean
          is_community_approved?: boolean | null
          media_urls?: string[] | null
          mood_at_post?: string | null
          mood_emoji_at_post?: string | null
          mood_public_at_post?: boolean
          mood_status_enabled_at_post?: boolean
          movement_status_at_post?: string | null
          movement_status_enabled_at_post?: boolean
          post_type?: string | null
          updated_at?: string
          user_id: string
          voting_ends_at?: string | null
          voting_period_active?: boolean | null
        }
        Update: {
          audio_url?: string | null
          blocked_reason?: string | null
          boost_until?: string | null
          content?: string | null
          created_at?: string
          id?: string
          is_blocked?: boolean
          is_community_approved?: boolean | null
          media_urls?: string[] | null
          mood_at_post?: string | null
          mood_emoji_at_post?: string | null
          mood_public_at_post?: boolean
          mood_status_enabled_at_post?: boolean
          movement_status_at_post?: string | null
          movement_status_enabled_at_post?: boolean
          post_type?: string | null
          updated_at?: string
          user_id?: string
          voting_ends_at?: string | null
          voting_period_active?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_moderation_stats: {
        Row: {
          approved_count: number
          removed_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_count?: number
          removed_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_count?: number
          removed_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_moderation_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_visits: {
        Row: {
          created_at: string
          id: string
          visited_id: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          visited_id: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          visited_id?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_visits_visited_id_fkey"
            columns: ["visited_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_visits_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_session_id: string | null
          adult_confirmed_at: string | null
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          birth_date_public: boolean
          cover_url: string | null
          cpf: string | null
          created_at: string
          current_mood: string | null
          current_mood_emoji: string | null
          current_mood_updated_at: string | null
          debate_available: boolean | null
          favorite_team: string | null
          favorite_team_public: boolean
          friend_code: string | null
          full_name: string | null
          gender: string | null
          gender_public: boolean
          id: string
          is_admin: boolean
          is_adult_confirmed: boolean
          is_blocked: boolean
          is_deleted: boolean
          last_seen: string | null
          latitude: number | null
          lgpd_data_deletion_requested_at: string | null
          longitude: number | null
          mesh_data_sent_bytes: number
          mood_public: boolean
          mood_status_enabled: boolean
          movement_status: string | null
          movement_status_enabled: boolean
          political_party: string | null
          political_party_public: boolean
          pq_mldsa_pubkey: string | null
          pq_mldsa_sig: string | null
          pq_keys_updated_at: string | null
          pq_mldsa_sig: string | null
          pq_mlkem_pubkey: string | null
          preferred_language: string | null
          privacy_accepted_at: string | null
          profile_visits_enabled: boolean
          registration_number: number | null
          relationship_partner_id: string | null
          relationship_status: string | null
          relationship_status_public: boolean
          sexual_orientation: string | null
          sexual_orientation_public: boolean
          terms_accepted_at: string | null
          updated_at: string
          username: string
        }
        Insert: {
          active_session_id?: string | null
          adult_confirmed_at?: string | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          birth_date_public?: boolean
          cover_url?: string | null
          cpf?: string | null
          created_at?: string
          current_mood?: string | null
          current_mood_emoji?: string | null
          current_mood_updated_at?: string | null
          debate_available?: boolean | null
          favorite_team?: string | null
          favorite_team_public?: boolean
          friend_code?: string | null
          full_name?: string | null
          gender?: string | null
          gender_public?: boolean
          id: string
          is_admin?: boolean
          is_adult_confirmed?: boolean
          is_blocked?: boolean
          is_deleted?: boolean
          last_seen?: string | null
          latitude?: number | null
          lgpd_data_deletion_requested_at?: string | null
          longitude?: number | null
          mesh_data_sent_bytes?: number
          mood_public?: boolean
          mood_status_enabled?: boolean
          movement_status?: string | null
          movement_status_enabled?: boolean
          political_party?: string | null
          political_party_public?: boolean
          pq_mldsa_pubkey?: string | null
          pq_mldsa_sig?: string | null
          pq_keys_updated_at?: string | null
          pq_mldsa_sig?: string | null
          pq_mlkem_pubkey?: string | null
          preferred_language?: string | null
          privacy_accepted_at?: string | null
          profile_visits_enabled?: boolean
          registration_number?: number | null
          relationship_partner_id?: string | null
          relationship_status?: string | null
          relationship_status_public?: boolean
          sexual_orientation?: string | null
          sexual_orientation_public?: boolean
          terms_accepted_at?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          active_session_id?: string | null
          adult_confirmed_at?: string | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          birth_date_public?: boolean
          cover_url?: string | null
          cpf?: string | null
          created_at?: string
          current_mood?: string | null
          current_mood_emoji?: string | null
          current_mood_updated_at?: string | null
          debate_available?: boolean | null
          favorite_team?: string | null
          favorite_team_public?: boolean
          friend_code?: string | null
          full_name?: string | null
          gender?: string | null
          gender_public?: boolean
          id?: string
          is_admin?: boolean
          is_adult_confirmed?: boolean
          is_blocked?: boolean
          is_deleted?: boolean
          last_seen?: string | null
          latitude?: number | null
          lgpd_data_deletion_requested_at?: string | null
          longitude?: number | null
          mesh_data_sent_bytes?: number
          mood_public?: boolean
          mood_status_enabled?: boolean
          movement_status?: string | null
          movement_status_enabled?: boolean
          political_party?: string | null
          political_party_public?: boolean
          pq_mldsa_pubkey?: string | null
          pq_mldsa_sig?: string | null
          pq_keys_updated_at?: string | null
          pq_mldsa_sig?: string | null
          pq_mlkem_pubkey?: string | null
          preferred_language?: string | null
          privacy_accepted_at?: string | null
          profile_visits_enabled?: boolean
          registration_number?: number | null
          relationship_partner_id?: string | null
          relationship_status?: string | null
          relationship_status_public?: boolean
          sexual_orientation?: string | null
          sexual_orientation_public?: boolean
          terms_accepted_at?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_relationship_partner_id_fkey"
            columns: ["relationship_partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          app_context: string
          created_at: string
          device_type: string | null
          disabled_at: string | null
          disabled_reason: string | null
          endpoint: string
          expiration_time: string | null
          failure_count: number
          fcm_token: string | null
          id: string
          is_active: boolean
          keys_auth: string | null
          keys_p256dh: string | null
          last_failure_at: string | null
          last_seen_at: string
          last_success_at: string | null
          platform: string | null
          subscription_json: Json | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          app_context?: string
          created_at?: string
          device_type?: string | null
          disabled_at?: string | null
          disabled_reason?: string | null
          endpoint: string
          expiration_time?: string | null
          failure_count?: number
          fcm_token?: string | null
          id?: string
          is_active?: boolean
          keys_auth?: string | null
          keys_p256dh?: string | null
          last_failure_at?: string | null
          last_seen_at?: string
          last_success_at?: string | null
          platform?: string | null
          subscription_json?: Json | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          app_context?: string
          created_at?: string
          device_type?: string | null
          disabled_at?: string | null
          disabled_reason?: string | null
          endpoint?: string
          expiration_time?: string | null
          failure_count?: number
          fcm_token?: string | null
          id?: string
          is_active?: boolean
          keys_auth?: string | null
          keys_p256dh?: string | null
          last_failure_at?: string | null
          last_seen_at?: string
          last_success_at?: string | null
          platform?: string | null
          subscription_json?: Json | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      relationship_requests: {
        Row: {
          created_at: string
          desired_status: string
          id: string
          receiver_id: string
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          desired_status: string
          id?: string
          receiver_id: string
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          desired_status?: string
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationship_requests_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          admin_note: string | null
          created_at: string | null
          description: string | null
          id: string
          post_id: string
          reason: string
          reporter_id: string
          reviewed_at: string | null
          status: string | null
          target_user_id: string | null
          updated_at: string | null
        }
        Insert: {
          admin_note?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          post_id: string
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          status?: string | null
          target_user_id?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_note?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          post_id?: string
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          status?: string | null
          target_user_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          expires_at: string
          id: string
          media_urls: string[] | null
          original_message_id: string | null
          owner_id: string
          requester_id: string
          saved_at: string | null
          status: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          expires_at?: string
          id?: string
          media_urls?: string[] | null
          original_message_id?: string | null
          owner_id: string
          requester_id: string
          saved_at?: string | null
          status?: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          media_urls?: string[] | null
          original_message_id?: string | null
          owner_id?: string
          requester_id?: string
          saved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_messages_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_messages_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          media_urls: string[] | null
          scheduled_at: string
          sender_id: string
          sent_message_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          media_urls?: string[] | null
          scheduled_at: string
          sender_id: string
          sent_message_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          media_urls?: string[] | null
          scheduled_at?: string
          sender_id?: string
          sent_message_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_sent_message_id_fkey"
            columns: ["sent_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          caption: string | null
          created_at: string
          expires_at: string
          id: string
          media_type: string
          media_url: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          id: string
          story_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          id?: string
          story_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          id?: string
          story_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      temporary_messages_archive: {
        Row: {
          archived_at: string
          content: string | null
          conversation_id: string
          deletion_reason: string | null
          id: string
          media_urls: string[] | null
          message_type: string
          original_created_at: string
          original_message_id: string
          user_id: string
        }
        Insert: {
          archived_at?: string
          content?: string | null
          conversation_id: string
          deletion_reason?: string | null
          id?: string
          media_urls?: string[] | null
          message_type?: string
          original_created_at: string
          original_message_id: string
          user_id: string
        }
        Update: {
          archived_at?: string
          content?: string | null
          conversation_id?: string
          deletion_reason?: string | null
          id?: string
          media_urls?: string[] | null
          message_type?: string
          original_created_at?: string
          original_message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "temporary_messages_archive_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temporary_messages_archive_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_cache: {
        Row: {
          created_at: string
          expires_at: string | null
          hit_count: number | null
          id: string
          source_lang: string
          source_text: string
          source_text_hash: string
          target_lang: string
          translated_text: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          hit_count?: number | null
          id?: string
          source_lang?: string
          source_text: string
          source_text_hash: string
          target_lang: string
          translated_text: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          hit_count?: number | null
          id?: string
          source_lang?: string
          source_text?: string
          source_text_hash?: string
          target_lang?: string
          translated_text?: string
        }
        Relationships: []
      }
      user_coins: {
        Row: {
          balance: number
          total_purchased: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          total_purchased?: number
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          total_purchased?: number
          total_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_coins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_consents: {
        Row: {
          accepted_at: string
          accepted_cookies: boolean
          accepted_data_processing: boolean
          accepted_location: boolean
          accepted_privacy: boolean
          accepted_push_notifications: boolean
          accepted_terms: boolean
          id: string
          ip_address: string | null
          privacy_version: string
          revocation_reason: string | null
          revoked_at: string | null
          terms_version: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          accepted_cookies?: boolean
          accepted_data_processing?: boolean
          accepted_location?: boolean
          accepted_privacy?: boolean
          accepted_push_notifications?: boolean
          accepted_terms?: boolean
          id?: string
          ip_address?: string | null
          privacy_version?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          terms_version?: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          accepted_cookies?: boolean
          accepted_data_processing?: boolean
          accepted_location?: boolean
          accepted_privacy?: boolean
          accepted_push_notifications?: boolean
          accepted_terms?: boolean
          id?: string
          ip_address?: string | null
          privacy_version?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          terms_version?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_diamonds: {
        Row: {
          balance: number
          pending_withdrawal: number
          total_earned: number
          total_withdrawn: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          pending_withdrawal?: number
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          pending_withdrawal?: number
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_diamonds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_stickers: {
        Row: {
          created_at: string
          height: number | null
          id: string
          is_public: boolean
          mime_type: string | null
          size_bytes: number | null
          tags: string[] | null
          title: string | null
          updated_at: string
          url: string
          user_id: string
          width: number | null
        }
        Insert: {
          created_at?: string
          height?: number | null
          id?: string
          is_public?: boolean
          mime_type?: string | null
          size_bytes?: number | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          url: string
          user_id: string
          width?: number | null
        }
        Update: {
          created_at?: string
          height?: number | null
          id?: string
          is_public?: boolean
          mime_type?: string | null
          size_bytes?: number | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          url?: string
          user_id?: string
          width?: number | null
        }
        Relationships: []
      }
      user_voices: {
        Row: {
          created_at: string
          provider: string
          sample_audio_url: string | null
          updated_at: string
          user_id: string
          voice_id: string
        }
        Insert: {
          created_at?: string
          provider?: string
          sample_audio_url?: string | null
          updated_at?: string
          user_id: string
          voice_id: string
        }
        Update: {
          created_at?: string
          provider?: string
          sample_audio_url?: string | null
          updated_at?: string
          user_id?: string
          voice_id?: string
        }
        Relationships: []
      }
      voice_translations: {
        Row: {
          conversation_id: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          method: string | null
          source_language: string
          target_language: string
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          method?: string | null
          source_language: string
          target_language: string
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          method?: string | null
          source_language?: string
          target_language?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_translations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_translations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          conversion_rate: number
          diamond_amount: number
          id: string
          notes: string | null
          payment_details: Json | null
          payment_method: string
          payout_amount: number
          processed_at: string | null
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          conversion_rate?: number
          diamond_amount: number
          id?: string
          notes?: string | null
          payment_details?: Json | null
          payment_method?: string
          payout_amount?: number
          processed_at?: string | null
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          conversion_rate?: number
          diamond_amount?: number
          id?: string
          notes?: string | null
          payment_details?: Json | null
          payment_method?: string
          payout_amount?: number
          processed_at?: string | null
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      zane_ai_chats: {
        Row: {
          created_at: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      zane_ai_messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          chat_id: string
          content: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "zane_ai_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "zane_ai_chats"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _pms_upsert_delta: {
        Args: { _delta_approved: number; _delta_removed: number; _user: string }
        Returns: undefined
      }
      activate_subscription: {
        Args: { p_months?: number; p_plan: string }
        Returns: Json
      }
      apply_invite_code: { Args: { p_code: string }; Returns: Json }
      buy_coins: {
        Args: { p_gateway?: string; p_pack_slug: string }
        Returns: Json
      }
      check_feature: { Args: { p_slug: string }; Returns: Json }
      confirm_pix_key: {
        Args: { p_code: string; p_key_id: string }
        Returns: Json
      }
      consume_feature: {
        Args: { p_request_id?: string; p_slug: string }
        Returns: Json
      }
      delete_pix_key: { Args: { p_key_id: string }; Returns: undefined }
      feature_prices: { Args: never; Returns: Json[] }
      get_my_pix_keys: { Args: never; Returns: Json }
      get_or_create_private_conversation: {
        Args: { p_other_id: string }
        Returns: string
      }
      join_battle_as_viewer: {
        Args: { p_battle_id: string }
        Returns: number
      }
      leave_battle_as_viewer: {
        Args: { p_battle_id: string }
        Returns: number
      }
      my_entitlements: { Args: never; Returns: Json }
      register_pix_key: { Args: { p_key: string }; Returns: Json }
      set_default_pix_key: { Args: { p_key_id: string }; Returns: undefined }
      store_config: { Args: never; Returns: Json }
      surrender_battle: { Args: { p_battle_id: string }; Returns: string }
      touch_battle_viewer: {
        Args: { p_battle_id: string }
        Returns: number
      }
      accept_battle: { Args: { p_battle_id: string }; Returns: string }
      add_group_members: {
        Args: { p_conversation_id: string; p_member_ids: string[] }
        Returns: undefined
      }
      admin_only_action: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      approve_battle_extension: {
        Args: { p_approve?: boolean; p_extension_id: string }
        Returns: {
          approved_by: string | null
          battle_id: string
          created_at: string
          extra_seconds: number
          id: string
          requested_by: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "battle_extensions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      are_friends: {
        Args: { user1_id: string; user2_id: string }
        Returns: boolean
      }
      attention_call_ack: { Args: { p_call_id: string }; Returns: undefined }
      attention_call_ack_many: {
        Args: { p_call_ids: string[] }
        Returns: number
      }
      attention_call_create: {
        Args: { message?: string; receiver_id: string }
        Returns: {
          created_at: string
          id: string
          message: string | null
          receiver_id: string
          sender_id: string
          viewed_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "attention_calls"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      attention_call_mark_viewed: {
        Args: { call_id: string }
        Returns: undefined
      }
      attention_call_silence: {
        Args: { minutes: number; sender_id: string }
        Returns: undefined
      }
      calculate_arena_statistics: {
        Args: never
        Returns: {
          approved_count: number
          in_voting_count: number
          processed_count: number
          rejected_count: number
        }[]
      }
      cancel_battle: { Args: { p_battle_id: string }; Returns: undefined }
      clean_old_notifications: { Args: never; Returns: undefined }
      cleanup_expired_save_requests: { Args: never; Returns: undefined }
      confirm_coin_purchase: {
        Args: { p_gateway_transaction_id?: string; p_order_id: string }
        Returns: undefined
      }
      convert_diamonds_to_currency: {
        Args: { p_diamond_amount: number; p_rate?: number }
        Returns: number
      }
      create_coin_purchase_order: {
        Args: {
          p_amount_coins: number
          p_currency?: string
          p_gateway?: string
          p_price: number
        }
        Returns: string
      }
      create_friendship_pair: {
        Args: { a: string; b: string }
        Returns: undefined
      }
      create_group: {
        Args: {
          p_description?: string
          p_member_ids?: string[]
          p_name: string
        }
        Returns: string
      }
      create_poll_message: {
        Args: {
          p_content: string
          p_conversation_id: string
          p_expires_at?: string
          p_is_anonymous?: boolean
          p_options: string[]
          p_question: string
        }
        Returns: string
      }
      credit_diamonds: {
        Args: { p_amount: number; p_user_id: string }
        Returns: undefined
      }
      deactivate_push_subscription: {
        Args: { p_endpoint: string; p_reason?: string }
        Returns: boolean
      }
      debit_coins: {
        Args: { p_amount: number; p_user_id: string }
        Returns: undefined
      }
      decline_battle: { Args: { p_battle_id: string }; Returns: undefined }
      delete_expired_messages: { Args: never; Returns: undefined }
      delete_expired_messages_batch: { Args: never; Returns: undefined }
      delete_message_for_all: {
        Args: { p_message_id: string }
        Returns: undefined
      }
      delete_my_push_subscription: {
        Args: { p_endpoint: string }
        Returns: boolean
      }
      delete_old_attention_calls: { Args: { p_days?: number }; Returns: number }
      end_battle: { Args: { p_battle_id: string }; Returns: string }
      ensure_profile: {
        Args: { p_user_id: string; p_username: string }
        Returns: undefined
      }
      examine_auth: { Args: never; Returns: string }
      expire_and_delete_message: {
        Args: { p_message_id: string }
        Returns: undefined
      }
      extend_battle: { Args: { p_battle_id: string }; Returns: string }
      generate_friend_code: { Args: never; Returns: string }
      generate_security_key: { Args: never; Returns: string }
      get_battle_leaderboard: {
        Args: { p_battle_id: string }
        Returns: {
          battle_id: string
          created_at: string
          gift_count: number
          id: string
          last_gift_at: string | null
          total_coins_spent: number
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "battle_participants"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_mood_quota: { Args: never; Returns: Json }
      get_my_conversations: { Args: { p_user_id: string }; Returns: string[] }
      get_or_create_dm_conversation: {
        Args: { p_user_a: string; p_user_b: string }
        Returns: {
          auto_translate: boolean | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          group_avatar: string | null
          group_description: string | null
          id: string
          is_group: boolean
          is_temporary: boolean | null
          max_participants: number | null
          name: string | null
          pinned: boolean | null
        }
        SetofOptions: {
          from: "*"
          to: "conversations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_platform_config: { Args: { p_key: string }; Returns: string }
      get_user_by_email: {
        Args: { p_email: string }
        Returns: {
          active_session_id: string | null
          adult_confirmed_at: string | null
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          birth_date_public: boolean
          cover_url: string | null
          cpf: string | null
          created_at: string
          current_mood: string | null
          current_mood_emoji: string | null
          current_mood_updated_at: string | null
          debate_available: boolean | null
          favorite_team: string | null
          favorite_team_public: boolean
          friend_code: string | null
          full_name: string | null
          gender: string | null
          gender_public: boolean
          id: string
          is_admin: boolean
          is_adult_confirmed: boolean
          is_blocked: boolean
          is_deleted: boolean
          last_seen: string | null
          latitude: number | null
          lgpd_data_deletion_requested_at: string | null
          longitude: number | null
          mesh_data_sent_bytes: number
          mood_public: boolean
          mood_status_enabled: boolean
          movement_status: string | null
          movement_status_enabled: boolean
          political_party: string | null
          political_party_public: boolean
          pq_mldsa_pubkey: string | null
          pq_mldsa_sig: string | null
          pq_keys_updated_at: string | null
          pq_mldsa_sig: string | null
          pq_mlkem_pubkey: string | null
          preferred_language: string | null
          privacy_accepted_at: string | null
          profile_visits_enabled: boolean
          registration_number: number | null
          relationship_partner_id: string | null
          relationship_status: string | null
          relationship_status_public: boolean
          sexual_orientation: string | null
          sexual_orientation_public: boolean
          terms_accepted_at: string | null
          updated_at: string
          username: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_user_coins: {
        Args: { p_user_id?: string }
        Returns: {
          balance: number
          total_purchased: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_coins"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_user_diamonds: {
        Args: { p_user_id?: string }
        Returns: {
          balance: number
          pending_withdrawal: number
          total_earned: number
          total_withdrawn: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_diamonds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      increment_share_count: { Args: { post_uuid: string }; Returns: undefined }
      is_adult: { Args: { birth_date: string }; Returns: boolean }
      is_conversation_member: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { conversation_uuid: string; user_uuid: string }
        Returns: boolean
      }
      is_participant: {
        Args: { p_conversation_id: string; p_user: string }
        Returns: boolean
      }
      leave_group: { Args: { p_conversation_id: string }; Returns: undefined }
      make_unique_username: { Args: { desired: string }; Returns: string }
      mark_daily_question_used: {
        Args: { p_pool_id: string; p_used_date: string }
        Returns: undefined
      }
      mark_message_viewed: {
        Args: { p_message_id: string; p_viewer: string }
        Returns: undefined
      }
      mark_viewed: { Args: { p_message_id: string }; Returns: undefined }
      mock_confirm_coin_purchase: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      process_expired_posts: { Args: never; Returns: undefined }
      process_withdrawal: {
        Args: { p_details?: Json; p_diamond_amount: number; p_method?: string }
        Returns: string
      }
      record_mood: {
        Args: { p_details?: Json; p_emoji: string; p_mood: string }
        Returns: Json
      }
      registration_slots_left: { Args: never; Returns: number }
      relay_mesh_messages: { Args: { p_ids: string[] }; Returns: number }
      remove_friendship_pair: {
        Args: { a: string; b: string }
        Returns: undefined
      }
      remove_group_member: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: undefined
      }
      request_user_id: { Args: never; Returns: string }
      respond_relationship_request: {
        Args: { p_request_id: string; p_response: string }
        Returns: undefined
      }
      search_messages: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          content: string
          conversation_id: string
          created_at: string
          message_id: string
          sender_id: string
        }[]
      }
      send_gift: {
        Args: {
          p_battle_id?: string
          p_gift_id: string
          p_quantity?: number
          p_receiver_id: string
        }
        Returns: {
          battle_id: string | null
          coins_spent: number
          created_at: string
          diamonds_earned: number
          gift_id: string
          id: string
          is_battle_gift: boolean
          platform_fee: number
          quantity: number
          receiver_id: string
          sender_id: string
        }
        SetofOptions: {
          from: "*"
          to: "gift_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_media_message: {
        Args: { p_conversation_id: string; p_media_urls: string[] }
        Returns: {
          content: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          detected_language: string | null
          edited_at: string | null
          expires_at: string | null
          id: string
          is_deleted: boolean
          is_edited: boolean
          is_pq_encrypted: boolean | null
          media_urls: string[] | null
          pq_signature: string | null
          updated_at: string
          user_id: string
          via_mesh: boolean
          viewed_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_text_message: {
        Args: { p_conversation_id: string; p_text: string }
        Returns: {
          content: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          detected_language: string | null
          edited_at: string | null
          expires_at: string | null
          id: string
          is_deleted: boolean
          is_edited: boolean
          is_pq_encrypted: boolean | null
          media_urls: string[] | null
          pq_signature: string | null
          updated_at: string
          user_id: string
          via_mesh: boolean
          viewed_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_message_undoing_batch: { Args: never; Returns: undefined }
      set_poll_vote: {
        Args: { p_option_id: string; p_poll_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      start_battle: {
        Args: { p_duration?: number; p_guest_id: string }
        Returns: string
      }
      toggle_message_reaction: {
        Args: { p_emoji: string; p_message_id: string }
        Returns: boolean
      }
      update_arena_statistics: { Args: never; Returns: undefined }
      update_arena_stats: { Args: never; Returns: undefined }
      update_group_info: {
        Args: {
          p_avatar?: string
          p_conversation_id: string
          p_description?: string
          p_name?: string
        }
        Returns: undefined
      }
      update_message_text: {
        Args: { p_message_id: string; p_new_content: string }
        Returns: {
          content: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          detected_language: string | null
          edited_at: string | null
          expires_at: string | null
          id: string
          is_deleted: boolean
          is_edited: boolean
          is_pq_encrypted: boolean | null
          media_urls: string[] | null
          pq_signature: string | null
          updated_at: string
          user_id: string
          via_mesh: boolean
          viewed_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_my_push_subscription: {
        Args: {
          p_endpoint: string
          p_expiration_time?: string
          p_keys_auth?: string
          p_keys_p256dh?: string
        }
        Returns: string
      }
      upsert_push_subscription: {
        Args: {
          p_app_context?: string
          p_device_type?: string
          p_endpoint: string
          p_expiration_time?: string
          p_keys_auth?: string
          p_keys_p256dh?: string
          p_platform?: string
          p_subscription_json?: Json
          p_user_agent?: string
        }
        Returns: string
      }
    }
    Enums: {
      debate_status: "pending" | "accepted" | "live" | "ended" | "declined"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      debate_status: ["pending", "accepted", "live", "ended", "declined"],
    },
  },
} as const
