import pg from 'pg';
import type { PaymentDatabase } from './service.js';
import { PaymentError } from './service.js';

// Use a dedicated server-only connection. Never expose this URL through VITE_*.
export function transactionalPaymentDatabase(database:PaymentDatabase):PaymentDatabase {
  const connectionString=process.env.PAYMENT_DATABASE_URL;
  if(!connectionString)throw new PaymentError('PAYMENT_DATABASE_URL is required for safe payout submission.',503);
  const connection=new URL(connectionString);
  if(!['postgres:','postgresql:'].includes(connection.protocol))throw new PaymentError('A PostgreSQL payment connection is required.',503);
  connection.searchParams.set('sslmode','verify-full');
  return {rpc:(name,args)=>database.rpc(name,args),withSubmissionLock:async(job,action)=>{
    const client=new pg.Client({connectionString:connection.toString(),connectionTimeoutMillis:10000});
    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout='10s'");
      // All inspection/dispute writers lock this booking before changing escrow state.
      await client.query('SELECT b.id FROM public.bookings b JOIN public.payment_escrows e ON e.booking_id=b.id JOIN public.payment_jobs j ON j.escrow_id=e.id WHERE j.id=$1 FOR UPDATE OF b',[job.id]);
      const locked:PaymentDatabase={rpc:async(name,args)=>{
        if(!['validate_payment_job','finish_payment_job'].includes(name))throw new Error('Unsupported transactional payment operation');
        const keys=Object.keys(args);
        const result=await client.query(`SELECT public.${name}(${keys.map((key,i)=>`${key} => $${i+1}`).join(',')}) AS data`,Object.values(args));
        return {data:result.rows[0].data,error:null};
      }};
      const result=await action(locked);
      await client.query('COMMIT');
      return result;
    } catch(error) {await client.query('ROLLBACK');throw error}
    finally {await client.end()}
  }};
}
