import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import DashboardHeader, { PlaceholderCards } from '../../components/dashboard/DashboardHeader'
import ApplicationStatusBar from '../../components/student/ApplicationStatusBar'
import EligibilityBanner from '../../components/student/EligibilityBanner'
import StudentProfileDetails from '../../components/student/StudentProfileDetails'
import VerificationBanner from '../../components/student/VerificationBanner'
import { Alert } from '../../components/ui/FormField'
import { getStudentDocument, getStudentProfile } from '../../services/api'
import { apiErrorMessage } from '../../utils/apiError'

export default function StudentDashboard() {
  const { t } = useTranslation()
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getStudentProfile()
      .then(setProfile)
      .catch((err) => setError(apiErrorMessage(err, t)))
  }, [t])

  return (
    <div className="space-y-8">
      {profile && <ApplicationStatusBar verification={profile.verification_status} eligibility={profile.eligibility_status} />}
      <DashboardHeader />
      <Alert>{error}</Alert>
      {profile && <EligibilityBanner status={profile.eligibility_status} />}
      {profile && <VerificationBanner status={profile.verification_status} verification={profile.verification} />}
      {profile && <StudentProfileDetails profile={profile} fetchDocument={getStudentDocument} editLink="/student/onboarding" onError={setError} />}
      <PlaceholderCards items={['dashboard.student.schemes', 'dashboard.student.applications']} />
    </div>
  )
}
