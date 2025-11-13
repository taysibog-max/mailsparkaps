import DashboardLayout from '../../components/DashboardLayout';

export default function Billing() {
  return (
    <DashboardLayout active="/dashboard/billing">
      <section className="glass rounded-xl p-4">
        <div className="text-neutral-300">Plan overview • Upgrade button • Limits.</div>
        <div className="mt-3"><button className="btn btn-primary">Upgrade plan</button></div>
      </section>
    </DashboardLayout>
  );
}


