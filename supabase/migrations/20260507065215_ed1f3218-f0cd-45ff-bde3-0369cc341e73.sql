
create policy "chat_messages public read" on public.chat_messages for select using (true);
create policy "word_crumbles public read" on public.word_crumbles for select using (true);
create policy "events public read" on public.events for select using (true);
