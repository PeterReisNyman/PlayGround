// import { createClient } from '@supabase/supabase-js';
// import { WhatsAppService } from '../whatsapp/whatsapp.service';

// const supabase = createClient<any>(
//   process.env.SUPABASE_URL ?? '',
//   process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
// );

// const whatsapp = new WhatsAppService();

// function optInPtText(name: string): string {
//   return `Olá ${name},\nobrigado por fornecer suas informações de contato pelo Facebook. Para ajudar a refinar sua estimativa, gostaria de fazer algumas perguntas rápidas.\n\nVocê poderia me contar um pouco sobre quaisquer atualizações ou melhorias recentes que tenha feito na propriedade? Coisas como reforma da cozinha, telhado novo ou piso atualizado podem influenciar bastante o valor.`;
// }

// function primeiraMensagemText(name: string): string {
//   return `Olá ${name}, obrigado por dedicar um tempo para preencher a pesquisa de avaliação do imóvel. Para refinar a sua estimativa, gostaria de fazer algumas perguntas rápidas.`;
// }

// function isRow(
//   row: unknown,
// ): row is {
//   id: number;
//   phone: string;
//   message_text?: string | null;
//   message_type?: string | null;
// } {
//   return (
//     typeof row === 'object' && row !== null && 'id' in row && 'phone' in row
//   );
// }

// export async function handler(): Promise<void> {
//   const now = new Date().toISOString();
//   console.log(`[Cron] cron.ts executing at ${now}`);
//   const { data, error } = await supabase
//     .from('scheduled_messages')
//     .select('*')
//     .eq('message_status', 'pending')
//     .lte('scheduled_time', now);

//   if (error) {
//     console.error('[Cron] Fetch error', error);
//     return;
//   }

//   console.log(`[Cron] Found ${data?.length ?? 0} pending messages`);

//   for (const raw of data ?? []) {
//     if (!isRow(raw)) {
//       console.warn('[Cron] Skipping malformed row');
//       continue;
//     }
//     try {
//       if (raw.message_type === 'template' && raw.message_text) {
//         const t = JSON.parse(raw.message_text);
//         await whatsapp.sendTemplate(raw.phone, t.name, t.language, t.components);
//       } else {
//         await whatsapp.sendMessage(raw.phone, raw.message_text ?? '');
//       }
//       console.log(`[Cron] Sent message ${raw.id} to ${raw.phone}`);
//       await supabase
//         .from('scheduled_messages')
//         .update({ message_status: 'sent' })
//         .eq('id', raw.id);
//       await supabase.from('messages').insert({
//         phone: raw.phone,
//         message_json: {
//           role: 'assistant',
//           content:
//             raw.message_type === 'template'
//               ? (() => {
//                   const t = JSON.parse(raw.message_text ?? '{}');
//                   if (t.name === 'opt_in_pt' || t.name === 'primeira_mensagem') {
//                     const comps = t.components ?? [];
//                     let userName = '{{name}}';
//                     const targetType = t.name === 'opt_in_pt' ? 'HEADER' : 'BODY';
//                     const part = Array.isArray(comps)
//                       ? comps.find((c: any) => c && c.type === targetType)
//                       : undefined;
//                     if (part && Array.isArray((part as any).parameters)) {
//                       const param = (part as any).parameters.find(
//                         (p: any) => p && p.type === 'TEXT' && typeof p.text === 'string',
//                       );
//                       if (param) userName = param.text;
//                     }
//                     return t.name === 'opt_in_pt'
//                       ? optInPtText(userName)
//                       : primeiraMensagemText(userName);
//                   }
//                   return `[template:${t.name}]`;
//                 })()
//               : raw.message_text ?? '',
//         },
//       });
//     } catch (err) {
//       console.error(`[Cron] Send failed for ${raw.id}`, err);
//       await supabase
//         .from('scheduled_messages')
//         .update({ message_status: 'failed' })
//         .eq('id', raw.id);
//       await supabase.from('messages').insert({
//         phone: raw.phone,
//         message_json: {
//           role: 'assistant',
//           content:
//             raw.message_type === 'template'
//               ? (() => {
//                   const t = JSON.parse(raw.message_text ?? '{}');
//                   if (t.name === 'opt_in_pt' || t.name === 'primeira_mensagem') {
//                     const comps = t.components ?? [];
//                     let userName = '{{name}}';
//                     const targetType = t.name === 'opt_in_pt' ? 'HEADER' : 'BODY';
//                     const part = Array.isArray(comps)
//                       ? comps.find((c: any) => c && c.type === targetType)
//                       : undefined;
//                     if (part && Array.isArray((part as any).parameters)) {
//                       const param = (part as any).parameters.find(
//                         (p: any) => p && p.type === 'TEXT' && typeof p.text === 'string',
//                       );
//                       if (param) userName = param.text;
//                     }
//                     return t.name === 'opt_in_pt'
//                       ? optInPtText(userName)
//                       : primeiraMensagemText(userName);
//                   }
//                   return `[template:${t.name}]`;
//                 })()
//               : raw.message_text ?? '',
//         },
//       });
//     }
//   }

//   console.log('[Cron] cron.ts run complete');
// }

// if (require.main === module) {
//   void handler().then(() => process.exit());
// }
