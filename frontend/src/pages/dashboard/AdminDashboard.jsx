import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import AdminTabs from '../../components/dashboard/AdminTabs'
import DashboardHeader from '../../components/dashboard/DashboardHeader'
import { EligibilityOverview } from '../../components/dashboard/EligibilityAdmin'
import ImpactHome from '../../components/home/ImpactHome'
import FormField, { Alert, SuccessNote, inputClass } from '../../components/ui/FormField'
import { ROLES } from '../../context/AuthContext'
import { createUserAsAdmin, getAdminStats, getAdminUsers } from '../../services/api'
import { apiErrorMessage } from '../../utils/apiError'
import { normalizeMobile } from '../../utils/validators'

const EMPTY_FORM = { name: '', phone: '', email: '', password: '', role: 'admin' }

export default function AdminDashboard() {
  const { t, i18n } = useTranslation()
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [roleFilter, setRoleFilter] = useState('')
  const [error, setError] = useState('')

  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setError('')
    Promise.all([getAdminStats(), getAdminUsers(roleFilter ? { role: roleFilter } : {})])
      .then(([s, u]) => {
        setStats(s)
        setUsers(u)
      })
      .catch((err) => setError(apiErrorMessage(err, t)))
  }, [roleFilter, t])

  useEffect(load, [load])

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const onCreate = async (e) => {
    e.preventDefault()
    setFormError('')
    setFormSuccess('')
    const phone = form.phone.trim() ? normalizeMobile(form.phone) : null
    if ((form.role === 'student' || form.phone.trim()) && !phone) return setFormError(t('auth.invalidPhone'))
    if (form.role !== 'student' && !form.email.trim()) return setFormError(t('auth.emailRequired'))

    setSaving(true)
    try {
      const created = await createUserAsAdmin({ ...form, phone, email: form.email.trim() || null })
      setFormSuccess(t('admin.userCreated', { name: created.name, role: t(`roles.${created.role}`) }))
      setForm(EMPTY_FORM)
      load()
    } catch (err) {
      setFormError(apiErrorMessage(err, t))
    } finally {
      setSaving(false)
    }
  }

  const dateFmt = new Intl.DateTimeFormat(i18n.language?.startsWith('mr') ? 'mr-IN' : 'en-IN', { dateStyle: 'medium' })

  return (
    <div className="space-y-8">
      <AdminTabs />
      <DashboardHeader />
      <ImpactHome />
      <Alert>{error}</Alert>

      <section className="grid gap-4 sm:grid-cols-3">
        {ROLES.map((role) => (
          <div key={role} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{t(`admin.count.${role}`)}</p>
            <p className="mt-1 text-3xl font-bold text-brand-700">{stats ? stats[role] : '—'}</p>
          </div>
        ))}
      </section>

      <EligibilityOverview />

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h2 className="text-lg font-semibold">{t('admin.users')}</h2>
          <label className="flex items-center gap-2 text-sm">
            {t('admin.filterByRole')}
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1">
              <option value="">{t('admin.allRoles')}</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`roles.${r}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">{t('auth.fullName')}</th>
                <th className="px-4 py-2 font-medium">{t('auth.phone')}</th>
                <th className="px-4 py-2 font-medium">{t('auth.email')}</th>
                <th className="px-4 py-2 font-medium">{t('admin.role')}</th>
                <th className="px-4 py-2 font-medium">{t('admin.joined')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{u.name}</td>
                  <td className="px-4 py-2">{u.phone || '—'}</td>
                  <td className="px-4 py-2">{u.email || '—'}</td>
                  <td className="px-4 py-2">{t(`roles.${u.role}`)}</td>
                  <td className="px-4 py-2">{u.created_at ? dateFmt.format(new Date(u.created_at)) : '—'}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    {t('admin.noUsers')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="max-w-xl rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">{t('admin.createUser')}</h2>
        <p className="mt-1 text-sm text-slate-600">{t('admin.createUserHint')}</p>
        <form onSubmit={onCreate} className="mt-4 space-y-4">
          <Alert>{formError}</Alert>
          <SuccessNote>{formSuccess}</SuccessNote>
          <FormField label={t('auth.fullName')} name="name" required minLength={2} value={form.name} onChange={onChange} />
          <FormField
            label={form.role === 'student' ? t('auth.phone') : t('auth.phoneOptional')}
            type="tel"
            inputMode="numeric"
            name="phone"
            prefix="+91"
            maxLength={14}
            required={form.role === 'student'}
            value={form.phone}
            onChange={onChange}
          />
          <FormField
            label={form.role === 'student' ? t('auth.emailOptional') : t('auth.email')}
            type="email"
            name="email"
            required={form.role !== 'student'}
            value={form.email}
            onChange={onChange}
          />
          <FormField
            label={t('auth.password')}
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={64}
            hint={t('auth.passwordHint')}
            value={form.password}
            onChange={onChange}
          />
          <label className="block text-sm font-medium text-slate-700">
            {t('admin.role')}
            <select name="role" value={form.role} onChange={onChange} className={inputClass}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`roles.${r}`)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={saving} className="rounded-lg bg-brand-gradient px-5 py-2 font-medium text-white hover:brightness-110 disabled:opacity-60">
            {t('admin.create')}
          </button>
        </form>
      </section>
    </div>
  )
}
