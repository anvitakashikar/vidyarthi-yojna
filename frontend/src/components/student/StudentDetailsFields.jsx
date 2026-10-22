import { useTranslation } from 'react-i18next'

import FormField, { inputClass } from '../ui/FormField'

export const EMPTY_DETAILS = { gender: '', guardian_name: '', guardian_phone: '', college_name: '', course: '', year_of_study: '' }
const YEARS = [1, 2, 3, 4, 5, 6, 7]

/** Section 1 "other details" — shared by registration and the edit form. */
export default function StudentDetailsFields({ form, onChange }) {
  const { t } = useTranslation()

  return (
    <>
      <label className="block text-sm font-medium text-slate-700">
        {t('details.gender')}
        <select name="gender" required value={form.gender} onChange={onChange} className={inputClass}>
          <option value="" disabled>
            {t('common.select')}
          </option>
          {['female', 'male', 'other'].map((g) => (
            <option key={g} value={g}>
              {t(`details.genders.${g}`)}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t('details.guardianName')} name="guardian_name" required minLength={2} value={form.guardian_name} onChange={onChange} />
        <FormField
          label={t('details.guardianPhone')}
          type="tel"
          inputMode="numeric"
          name="guardian_phone"
          prefix="+91"
          maxLength={14}
          value={form.guardian_phone}
          onChange={onChange}
        />
      </div>
      <FormField label={t('details.college')} name="college_name" required value={form.college_name} onChange={onChange} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t('details.course')} name="course" required placeholder={t('details.coursePlaceholder')} value={form.course} onChange={onChange} />
        <label className="block text-sm font-medium text-slate-700">
          {t('details.year')}
          <select name="year_of_study" required value={form.year_of_study} onChange={onChange} className={inputClass}>
            <option value="" disabled>
              {t('common.select')}
            </option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {t('details.yearN', { n: y })}
              </option>
            ))}
          </select>
        </label>
      </div>
    </>
  )
}

/** Converts the form state into the API payload; returns [payload, errorKey]. */
export function detailsPayload(form, normalizeMobile) {
  const guardianPhone = form.guardian_phone.trim() ? normalizeMobile(form.guardian_phone) : null
  if (form.guardian_phone.trim() && !guardianPhone) return [null, 'auth.invalidPhone']
  return [
    {
      gender: form.gender,
      guardian_name: form.guardian_name.trim(),
      guardian_phone: guardianPhone,
      college_name: form.college_name.trim(),
      course: form.course.trim(),
      year_of_study: Number(form.year_of_study),
    },
    null,
  ]
}
