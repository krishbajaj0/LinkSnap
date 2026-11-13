export default function DashboardPage({ title, description }) {
  return (
    <section aria-labelledby="dashboard-page-title">
      <h1 id="dashboard-page-title">{title}</h1>
      <div className="dashboard-panel">
        <h2>Under development</h2>
        <p>{description}</p>
      </div>
    </section>
  );
}
