import { Layout } from '../components/Layout'

export default function ShoppingPage() {
  return (
    <Layout
      title="Shop"
      actions={
        <button className="btn btn-primary" type="button">
          Register
        </button>
      }
    >
      <p className="text-muted">Browse the shop.</p>
    </Layout>
  )
}
