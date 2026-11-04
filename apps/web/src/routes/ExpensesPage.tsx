import { CustomerHeader } from '../components/CustomerHeader'

/** Landing page after sign-up; real Expenses content belongs to another story. */
export default function ExpensesPage() {
  return (
    <>
      <CustomerHeader />
      <main className="content">
        <h1 className="heading-lg">Expenses</h1>
      </main>
    </>
  )
}
