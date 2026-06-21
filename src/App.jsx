import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { Login } from './pages/Login'
import { Home } from './pages/Home'
import { Products } from './pages/Products'
import { ProductForm } from './pages/ProductForm'
import { NewSale } from './pages/NewSale'
import { NewPurchase } from './pages/NewPurchase'
import { AddExpense } from './pages/AddExpense'
import { RecordPayment } from './pages/RecordPayment'
import { More } from './pages/More'
import { Customers } from './pages/Customers'
import { Suppliers } from './pages/Suppliers'
import { Reports } from './pages/Reports'

function AuthenticatedRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/products" element={<Products />} />
      <Route path="/products/new" element={<ProductForm />} />
      <Route path="/products/:id/edit" element={<ProductForm />} />
      <Route path="/sales/new" element={<NewSale />} />
      <Route path="/purchases/new" element={<NewPurchase />} />
      <Route path="/expenses/new" element={<AddExpense />} />
      <Route path="/payments/new" element={<RecordPayment />} />
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
    <BrowserRouter basename="/finance-management-">
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
