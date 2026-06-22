import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { Login } from './pages/Login'
import { Home } from './pages/Home'
import { Products } from './pages/Products'
import { ProductForm } from './pages/ProductForm'
import { NewSale } from './pages/NewSale'
import { SalesList } from './pages/SalesList'
import { SaleDetail } from './pages/SaleDetail'
import { NewPurchase } from './pages/NewPurchase'
import { PurchaseList } from './pages/PurchaseList'
import { PurchaseDetail } from './pages/PurchaseDetail'
import { AddExpense } from './pages/AddExpense'
import { ExpenseList } from './pages/ExpenseList'
import { RecordPayment } from './pages/RecordPayment'
import { PaymentList } from './pages/PaymentList'
import { QuotationList } from './pages/QuotationList'
import { NewQuotation } from './pages/NewQuotation'
import { QuotationDetail } from './pages/QuotationDetail'
import { NewReturn } from './pages/NewReturn'
import { ReturnsList } from './pages/ReturnsList'
import { StockTransfer } from './pages/StockTransfer'
import { More } from './pages/More'
import { Customers } from './pages/Customers'
import { Suppliers } from './pages/Suppliers'
import { Reports } from './pages/Reports'

function AuthenticatedRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />

      {/* Products */}
      <Route path="/products" element={<Products />} />
      <Route path="/products/new" element={<ProductForm />} />
      <Route path="/products/:id/edit" element={<ProductForm />} />

      {/* Sales */}
      <Route path="/sales" element={<SalesList />} />
      <Route path="/sales/new" element={<NewSale />} />
      <Route path="/sales/:id" element={<SaleDetail />} />

      {/* Purchases */}
      <Route path="/purchases" element={<PurchaseList />} />
      <Route path="/purchases/new" element={<NewPurchase />} />
      <Route path="/purchases/:id" element={<PurchaseDetail />} />

      {/* Expenses */}
      <Route path="/expenses" element={<ExpenseList />} />
      <Route path="/expenses/new" element={<AddExpense />} />

      {/* Payments */}
      <Route path="/payments" element={<PaymentList />} />
      <Route path="/payments/new" element={<RecordPayment />} />

      {/* Quotations */}
      <Route path="/quotations" element={<QuotationList />} />
      <Route path="/quotations/new" element={<NewQuotation />} />
      <Route path="/quotations/:id" element={<QuotationDetail />} />

      {/* Returns */}
      <Route path="/returns" element={<ReturnsList />} />
      <Route path="/returns/new" element={<NewReturn />} />

      {/* Stock */}
      <Route path="/stock/transfer" element={<StockTransfer />} />

      {/* Other */}
      <Route path="/more" element={<More />} />
      <Route path="/customers" element={<Customers />} />
      <Route path="/suppliers" element={<Suppliers />} />
      <Route path="/reports" element={<Reports />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function AppRoutes() {
  const { session } = useAuth()

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-blue-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Login />

  return <AuthenticatedRoutes />
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </HashRouter>
  )
}
