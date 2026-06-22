import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { Layout } from '../components/Layout'
import { newId, nowIso } from '../utils/format'

const CATEGORIES = [
  'Engine Parts', 'Filters', 'Brakes', 'Suspension', 'Electrical',
  'Belts & Hoses', 'Fluids & Oils', 'Body Parts', 'Transmission',
  'Exhaust', 'Cooling System', 'Tyres & Wheels', 'Other',
]

const EMPTY = {
  name: '', sku: '', category: '',
  cost_price: '', selling_price: '', wholesale_price: '',
  qty_warehouse: '0', qty_store: '0', reorder_level: '5',
  supplier_id: '',
  oem_number: '', barcode: '', warranty_months: '0',
  vehicle_makes: '', vehicle_models: '', year_from: '', year_to: '',
  active: true,
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

export function ProductForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = !!id

  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const suppliers = useLiveQuery(() => db.suppliers.orderBy('name').toArray(), [])

  useEffect(() => {
    if (isEditing) {
      db.products.get(id).then((p) => {
        if (p) {
          setForm({
            name: p.name ?? '',
            sku: p.sku ?? '',
            category: p.category ?? '',
            cost_price: String(p.cost_price ?? ''),
            selling_price: String(p.selling_price ?? ''),
            wholesale_price: String(p.wholesale_price ?? ''),
            qty_warehouse: String(p.qty_warehouse ?? 0),
            qty_store: String(p.qty_store ?? 0),
            reorder_level: String(p.reorder_level ?? 0),
            supplier_id: p.supplier_id ?? '',
            oem_number: p.oem_number ?? '',
            barcode: p.barcode ?? '',
            warranty_months: String(p.warranty_months ?? 0),
            vehicle_makes: p.vehicle_makes ?? '',
            vehicle_models: p.vehicle_models ?? '',
            year_from: p.year_from ? String(p.year_from) : '',
            year_to: p.year_to ? String(p.year_to) : '',
            active: p.active !== 0,
          })
        }
      })
    }
  }, [id, isEditing])

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError('Product name is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const product = {
        id: isEditing ? id : newId(),
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        category: form.category.trim() || null,
        cost_price: parseFloat(form.cost_price) || 0,
        selling_price: parseFloat(form.selling_price) || 0,
        wholesale_price: parseFloat(form.wholesale_price) || parseFloat(form.selling_price) || 0,
        qty_warehouse: parseInt(form.qty_warehouse, 10) || 0,
        qty_store: parseInt(form.qty_store, 10) || 0,
        reorder_level: parseInt(form.reorder_level, 10) || 0,
        supplier_id: form.supplier_id || null,
        oem_number: form.oem_number.trim() || null,
        barcode: form.barcode.trim() || null,
        warranty_months: parseInt(form.warranty_months, 10) || 0,
        vehicle_makes: form.vehicle_makes.trim() || null,
        vehicle_models: form.vehicle_models.trim() || null,
        year_from: form.year_from ? parseInt(form.year_from, 10) : null,
        year_to: form.year_to ? parseInt(form.year_to, 10) : null,
        active: form.active ? 1 : 0,
        updated_at: nowIso(),
        synced: 0,
      }
      await db.products.put(product)
      navigate('/products')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this product? This cannot be undone.')) return
    await db.products.delete(id)
    navigate('/products')
  }

  return (
    <Layout title={isEditing ? 'Edit Product' : 'Add Product'} showBack>
      <div className="space-y-4 pb-4">

        {/* Active toggle */}
        {isEditing && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Active</p>
              <p className="text-xs text-gray-400">Inactive products are hidden from the sales screen</p>
            </div>
            <button
              onClick={() => set('active', !form.active)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.active ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  form.active ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        )}

        {/* Core info */}
        <Field label="Product Name" required>
          <input
            className={inputCls}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g., Toyota Oil Filter"
            autoFocus={!isEditing}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="SKU / Part No.">
            <input
              className={inputCls}
              value={form.sku}
              onChange={(e) => set('sku', e.target.value)}
              placeholder="e.g., TY-90915"
            />
          </Field>
          <Field label="OEM Number">
            <input
              className={inputCls}
              value={form.oem_number}
              onChange={(e) => set('oem_number', e.target.value)}
              placeholder="Original part no."
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <input
              list="product-categories"
              className={inputCls}
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              placeholder="Pick or type…"
            />
            <datalist id="product-categories">
              {CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Barcode">
            <input
              className={inputCls}
              value={form.barcode}
              onChange={(e) => set('barcode', e.target.value)}
              placeholder="EAN / UPC"
            />
          </Field>
        </div>

        {/* Pricing */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pricing</p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Cost Price">
            <input
              type="number" min="0" step="0.01"
              className={inputCls}
              value={form.cost_price}
              onChange={(e) => set('cost_price', e.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label="Retail Price">
            <input
              type="number" min="0" step="0.01"
              className={inputCls}
              value={form.selling_price}
              onChange={(e) => set('selling_price', e.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label="Wholesale">
            <input
              type="number" min="0" step="0.01"
              className={inputCls}
              value={form.wholesale_price}
              onChange={(e) => set('wholesale_price', e.target.value)}
              placeholder="0.00"
            />
          </Field>
        </div>

        {/* Stock */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Stock</p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Warehouse Qty">
            <input
              type="number" min="0"
              className={inputCls}
              value={form.qty_warehouse}
              onChange={(e) => set('qty_warehouse', e.target.value)}
            />
          </Field>
          <Field label="Store Qty">
            <input
              type="number" min="0"
              className={inputCls}
              value={form.qty_store}
              onChange={(e) => set('qty_store', e.target.value)}
            />
          </Field>
          <Field label="Reorder Level">
            <input
              type="number" min="0"
              className={inputCls}
              value={form.reorder_level}
              onChange={(e) => set('reorder_level', e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Warranty (months)">
            <input
              type="number" min="0"
              className={inputCls}
              value={form.warranty_months}
              onChange={(e) => set('warranty_months', e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Supplier">
            <select
              className={inputCls}
              value={form.supplier_id}
              onChange={(e) => set('supplier_id', e.target.value)}
            >
              <option value="">— None —</option>
              {(suppliers ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
        </div>

        {/* Vehicle compatibility */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Vehicle Compatibility (optional)
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Makes">
            <input
              className={inputCls}
              value={form.vehicle_makes}
              onChange={(e) => set('vehicle_makes', e.target.value)}
              placeholder="Toyota, Honda…"
            />
          </Field>
          <Field label="Models">
            <input
              className={inputCls}
              value={form.vehicle_models}
              onChange={(e) => set('vehicle_models', e.target.value)}
              placeholder="Corolla, Civic…"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Year From">
            <input
              type="number" min="1960" max="2050"
              className={inputCls}
              value={form.year_from}
              onChange={(e) => set('year_from', e.target.value)}
              placeholder="e.g., 2010"
            />
          </Field>
          <Field label="Year To">
            <input
              type="number" min="1960" max="2050"
              className={inputCls}
              value={form.year_to}
              onChange={(e) => set('year_to', e.target.value)}
              placeholder="e.g., 2020"
            />
          </Field>
        </div>

        {error && (
          <p className="text-red-600 bg-red-50 rounded-xl px-4 py-3 text-sm">{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-bold rounded-xl py-4 text-base transition-colors"
        >
          {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Product'}
        </button>

        {isEditing && (
          <button
            onClick={handleDelete}
            className="w-full text-red-600 hover:text-red-800 text-sm underline py-2"
          >
            Delete this product
          </button>
        )}
      </div>
    </Layout>
  )
}
