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
  cost_price: '', selling_price: '',
  quantity_on_hand: '0', reorder_level: '5',
  supplier_id: '',
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

  // Pre-fill form when editing an existing product
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
            quantity_on_hand: String(p.quantity_on_hand ?? 0),
            reorder_level: String(p.reorder_level ?? 0),
            supplier_id: p.supplier_id ?? '',
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
        quantity_on_hand: parseInt(form.quantity_on_hand, 10) || 0,
        reorder_level: parseInt(form.reorder_level, 10) || 0,
        supplier_id: form.supplier_id || null,
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
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost Price">
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputCls}
              value={form.cost_price}
              onChange={(e) => set('cost_price', e.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label="Selling Price">
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputCls}
              value={form.selling_price}
              onChange={(e) => set('selling_price', e.target.value)}
              placeholder="0.00"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Qty in Stock">
            <input
              type="number"
              min="0"
              className={inputCls}
              value={form.quantity_on_hand}
              onChange={(e) => set('quantity_on_hand', e.target.value)}
            />
          </Field>
          <Field label="Reorder Level">
            <input
              type="number"
              min="0"
              className={inputCls}
              value={form.reorder_level}
              onChange={(e) => set('reorder_level', e.target.value)}
            />
          </Field>
        </div>

        <Field label="Supplier">
          <select
            className={inputCls}
            value={form.supplier_id}
            onChange={(e) => set('supplier_id', e.target.value)}
          >
            <option value="">— None —</option>
            {(suppliers ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

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
