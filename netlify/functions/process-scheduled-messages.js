import { schedule } from "@netlify/functions";
import { createAdminClient } from "./_shared.js";

const processScheduledMessages = async (event) => {
  console.log("Iniciando processamento de mensagens agendadas...");
  
  let supabase;
  try {
    supabase = createAdminClient();
  } catch (err) {
    console.error("Erro ao inicializar cliente admin do Supabase:", err);
    return { statusCode: 500, body: "Erro de configuracao do servidor" };
  }

  try {
    // 0. Limpeza de espectadores órfãos das Batalhas ao Vivo (heartbeat > 90s)
    try {
      const { data: cleaned } = await supabase.rpc("cleanup_stale_battle_viewers");
      if (cleaned && cleaned > 0) {
        console.log(`Battles: ${cleaned} espectadores inativos removidos.`);
      }
    } catch (cleanErr) {
      console.error("Erro ao limpar battle_viewers:", cleanErr);
    }

    // 1. Buscar mensagens pendentes onde a data de agendamento passou
    const { data: pendingMessages, error: selectError } = await supabase
      .from("scheduled_messages")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString());

    if (selectError) {
      console.error("Erro ao carregar mensagens pendentes:", selectError);
      return { statusCode: 500, body: JSON.stringify({ error: selectError.message }) };
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log("Nenhuma mensagem agendada pendente.");
      return { statusCode: 200, body: "Nenhuma mensagem pendente." };
    }

    console.log(`Encontradas ${pendingMessages.length} mensagens para processar.`);

    for (const msg of pendingMessages) {
      try {
        // Reserva a mensagem ANTES de enviar. Evita envio duplicado quando uma
        // execucao do cron (1 min) ainda esta rodando e a proxima ja comecou:
        // as duas liam a mesma linha 'pending'. So segue quem conseguir mudar o
        // status de 'pending' para 'sent' — usa apenas valores ja existentes no
        // schema ('pending' | 'sent' | 'cancelled' | 'failed'). Se o envio
        // falhar depois, a linha volta para 'failed' logo abaixo.
        const { data: claimed, error: claimError } = await supabase
          .from("scheduled_messages")
          .update({ status: "sent", updated_at: new Date().toISOString() })
          .eq("id", msg.id)
          .eq("status", "pending")
          .select("id");

        if (claimError) {
          console.error(`Erro ao reservar mensagem ${msg.id}:`, claimError);
          continue;
        }
        if (!claimed || claimed.length === 0) {
          console.log(`Mensagem ${msg.id} ja foi processada por outra execucao. Pulando.`);
          continue;
        }

        // Enviar a mensagem: Inserir na tabela messages
        const { data: insertedMsg, error: insertError } = await supabase
          .from("messages")
          .insert({
            conversation_id: msg.conversation_id,
            user_id: msg.sender_id,
            content: msg.content,
            media_urls: msg.media_urls,
          })
          .select("*")
          .single();

        if (insertError) {
          console.error(`Erro ao inserir mensagem ${msg.id}:`, insertError);
          // Marcar como failed
          await supabase
            .from("scheduled_messages")
            .update({ status: "failed", updated_at: new Date().toISOString() })
            .eq("id", msg.id);
          continue;
        }

        // Ja marcada como 'sent' na reserva acima; aqui so associa a mensagem enviada.
        await supabase
          .from("scheduled_messages")
          .update({
            status: "sent",
            sent_message_id: insertedMsg.id,
            updated_at: new Date().toISOString()
          })
          .eq("id", msg.id);

        console.log(`Mensagem agendada ${msg.id} enviada com sucesso!`);
      } catch (innerError) {
        console.error(`Erro interno ao processar mensagem ${msg.id}:`, innerError);
      }
    }

    return { statusCode: 200, body: `Processadas ${pendingMessages.length} mensagens.` };
  } catch (error) {
    console.error("Erro fatal no processamento de mensagens:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

// Configura para rodar a cada 1 minuto (cron de 1 minuto)
export const handler = schedule("* * * * *", processScheduledMessages);
