import { supabase } from './supabase'

export async function getChatMessages() {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

export async function sendChatMessage({ sender_id, sender_name, message }) {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert([{
      sender_id,
      sender_name,
      message,
      message_type: 'text',
    }])
    .select()
    .single()

  if (error) throw error
  return data
}

export function subscribeToChatMessages(onMessage) {
  const channel = supabase
    .channel('chat_messages_realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages' },
      payload => onMessage(payload.new)
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
