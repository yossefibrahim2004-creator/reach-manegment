update public.contact_numbers
set number = case number
  when '+201000000000' then '+201030006425'
  when '+201111111111' then '+201042956387'
end
where number in ('+201000000000', '+201111111111');
