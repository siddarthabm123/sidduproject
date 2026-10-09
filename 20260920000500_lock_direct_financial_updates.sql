REVOKE UPDATE, DELETE ON public.wallets FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.wallet_transactions FROM authenticated;
REVOKE UPDATE, DELETE ON public.bookings FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.audit_events FROM authenticated;

GRANT SELECT ON public.users, public.wallets, public.wallet_transactions, public.equipment, public.bookings, public.equipment_locations, public.reviews, public.audit_events TO authenticated;
GRANT INSERT ON public.bookings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.equipment TO authenticated;
GRANT INSERT ON public.equipment_locations TO authenticated;
GRANT INSERT ON public.reviews TO authenticated;

COMMENT ON FUNCTION public.wallet_deposit(integer, text) IS 'Authenticated RPC for adding wallet balance after UPI confirmation.';
COMMENT ON FUNCTION public.wallet_withdraw(integer, text) IS 'Authenticated RPC for withdrawing only available wallet balance.';
COMMENT ON FUNCTION public.accept_booking(uuid) IS 'Owner RPC that accepts a pending booking and atomically locks the customer safety deposit.';
COMMENT ON FUNCTION public.cancel_booking(uuid) IS 'Customer RPC that cancels pending bookings freely or deducts penalty from locked deposit after owner acceptance.';
COMMENT ON FUNCTION public.complete_booking(uuid) IS 'Owner RPC that completes accepted work and releases the customer safety deposit.';
