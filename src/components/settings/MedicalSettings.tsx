'use client'

import { useState, useEffect } from 'react'
import { BaileyUserProfile } from '@/types/bailey-profile'
import { Stethoscope, AlertTriangle, Plus, X } from 'lucide-react'

interface MedicalSettingsProps {
  profile: Partial<BaileyUserProfile> | null
  onUpdate: (data: Partial<BaileyUserProfile>) => void
}

export default function MedicalSettings({ profile, onUpdate }: MedicalSettingsProps) {
  const [formData, setFormData] = useState({
    medical: {
      currentMedications: profile?.medical?.currentMedications || [],
      skinMedications: profile?.medical?.skinMedications || [],
      allergies: profile?.medical?.allergies || [],
      allergiesText: profile?.medical?.allergiesText || '',
      medicalConditions: profile?.medical?.medicalConditions || [],
      hormoneStatus: profile?.medical?.hormoneStatus || 'regular' as 'regular' | 'irregular' | 'pregnancy' | 'menopause' | 'birth-control',
      lastDermatologistVisit: profile?.medical?.lastDermatologistVisit || undefined
    }
  })

  const [newMedication, setNewMedication] = useState('')
  const [newCondition, setNewCondition] = useState('')
  const [newAllergy, setNewAllergy] = useState('')

  useEffect(() => {
    setFormData({
      medical: {
        currentMedications: profile?.medical?.currentMedications || [],
        skinMedications: profile?.medical?.skinMedications || [],
        allergies: profile?.medical?.allergies || [],
        allergiesText: profile?.medical?.allergiesText || '',
        medicalConditions: profile?.medical?.medicalConditions || [],
        hormoneStatus: profile?.medical?.hormoneStatus || 'regular' as 'regular' | 'irregular' | 'pregnancy' | 'menopause' | 'birth-control',
        lastDermatologistVisit: profile?.medical?.lastDermatologistVisit || undefined
      }
    })
  }, [profile])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => {
      const updated = { ...prev }
      const [parent, child] = field.split('.')

      if (parent === 'medical') {
        updated.medical = {
          ...updated.medical,
          [child]: value
        }
      }
      return updated
    })
    onUpdate(formData)
  }

  const addToArray = (field: string, value: string, setter: (value: string) => void) => {
    if (!value.trim()) return

    const currentArray = formData.medical[field as keyof typeof formData.medical] as string[]
    if (!currentArray.includes(value.trim())) {
      handleInputChange(`medical.${field}`, [...currentArray, value.trim()])
    }
    setter('')
  }

  const removeFromArray = (field: string, index: number) => {
    const currentArray = formData.medical[field as keyof typeof formData.medical] as string[]
    const newArray = currentArray.filter((_, i) => i !== index)
    handleInputChange(`medical.${field}`, newArray)
  }

  const commonMedications = [
    'Birth Control Pills', 'Accutane/Isotretinoin', 'Antibiotics', 'Retinoids (Prescription)',
    'Spironolactone', 'Blood Pressure Medication', 'Antidepressants', 'Hormone Replacement'
  ]

  const commonConditions = [
    'Eczema', 'Psoriasis', 'Rosacea', 'Seborrheic Dermatitis', 'PCOS', 'Thyroid Disorder',
    'Autoimmune Condition', 'Diabetes', 'Hormonal Imbalance'
  ]

  const commonAllergies = [
    'Nickel', 'Fragrance', 'Latex', 'Parabens', 'Sulfates', 'Formaldehyde',
    'Lanolin', 'Propylene Glycol', 'Essential Oils'
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-light text-white mb-2">Medical Information</h2>
        <p className="text-gray-400">
          Medical history helps Bailey ensure product safety and avoid contraindicated ingredients
        </p>
        <div className="mt-3 p-3 bg-blue-900/20 border border-blue-400/30 rounded-lg">
          <p className="text-sm text-blue-300 flex items-center">
            <AlertTriangle className="w-4 h-4 mr-2" />
            This information is confidential and used only for product safety recommendations
          </p>
        </div>
      </div>

      {/* Pregnancy & Breastfeeding */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
          <Stethoscope className="w-5 h-5 mr-2" />
          Hormonal Status
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Hormone Status
            </label>
            <select
              value={formData.medical.hormoneStatus}
              onChange={(e) => handleInputChange('medical.hormoneStatus', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] transition-colors"
            >
              <option value="regular">Regular cycles</option>
              <option value="irregular">Irregular cycles</option>
              <option value="pregnancy">Pregnancy</option>
              <option value="menopause">Menopause</option>
              <option value="birth-control">Birth control</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Hormonal changes significantly affect skin condition
            </p>
          </div>
          {(formData.medical.hormoneStatus === 'pregnancy' || formData.medical.hormoneStatus === 'menopause') && (
            <p className="text-sm text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded p-3">
              Bailey will exclude pregnancy-unsafe ingredients like retinoids and certain acids
            </p>
          )}
        </div>
      </div>


      {/* Current Medications */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4">Current Medications</h3>
        <div className="space-y-4">
          <div className="flex space-x-2">
            <input
              type="text"
              value={newMedication}
              onChange={(e) => setNewMedication(e.target.value)}
              placeholder="Enter medication name"
              className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] transition-colors"
              onKeyPress={(e) => e.key === 'Enter' && addToArray('currentMedications', newMedication, setNewMedication)}
            />
            <button
              onClick={() => addToArray('currentMedications', newMedication, setNewMedication)}
              className="px-4 py-3 bg-[#d4a574] text-black rounded-lg hover:bg-[#d4a574]/90 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Common medications shortcuts */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {commonMedications.map(med => (
              <button
                key={med}
                onClick={() => addToArray('currentMedications', med, setNewMedication)}
                className="text-xs px-3 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
              >
                {med}
              </button>
            ))}
          </div>

          {/* Current medications list */}
          {formData.medical.currentMedications.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-300">Current Medications:</p>
              {formData.medical.currentMedications.map((med, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-800/50 px-3 py-2 rounded">
                  <span className="text-gray-300">{med}</span>
                  <button
                    onClick={() => removeFromArray('currentMedications', index)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Medical Conditions */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4">Medical Conditions</h3>
        <div className="space-y-4">
          <div className="flex space-x-2">
            <input
              type="text"
              value={newCondition}
              onChange={(e) => setNewCondition(e.target.value)}
              placeholder="Enter medical condition"
              className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] transition-colors"
              onKeyPress={(e) => e.key === 'Enter' && addToArray('medicalConditions', newCondition, setNewCondition)}
            />
            <button
              onClick={() => addToArray('medicalConditions', newCondition, setNewCondition)}
              className="px-4 py-3 bg-[#d4a574] text-black rounded-lg hover:bg-[#d4a574]/90 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Common conditions shortcuts */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {commonConditions.map(condition => (
              <button
                key={condition}
                onClick={() => addToArray('medicalConditions', condition, setNewCondition)}
                className="text-xs px-3 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
              >
                {condition}
              </button>
            ))}
          </div>

          {/* Current conditions list */}
          {formData.medical.medicalConditions.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-300">Current Conditions:</p>
              {formData.medical.medicalConditions.map((condition, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-800/50 px-3 py-2 rounded">
                  <span className="text-gray-300">{condition}</span>
                  <button
                    onClick={() => removeFromArray('medicalConditions', index)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Allergies */}
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#d4a574] mb-4 flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2" />
          Known Allergies
        </h3>
        <div className="space-y-4">
          <div className="flex space-x-2">
            <input
              type="text"
              value={newAllergy}
              onChange={(e) => setNewAllergy(e.target.value)}
              placeholder="Enter allergy or sensitivity"
              className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] transition-colors"
              onKeyPress={(e) => e.key === 'Enter' && addToArray('allergies', newAllergy, setNewAllergy)}
            />
            <button
              onClick={() => addToArray('allergies', newAllergy, setNewAllergy)}
              className="px-4 py-3 bg-[#d4a574] text-black rounded-lg hover:bg-[#d4a574]/90 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Common allergies shortcuts */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {commonAllergies.map(allergy => (
              <button
                key={allergy}
                onClick={() => addToArray('allergies', allergy, setNewAllergy)}
                className="text-xs px-3 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
              >
                {allergy}
              </button>
            ))}
          </div>

          {/* Current allergies list */}
          {formData.medical.allergies.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-300">Known Allergies:</p>
              {formData.medical.allergies.map((allergy, index) => (
                <div key={index} className="flex items-center justify-between bg-red-900/20 border border-red-400/30 px-3 py-2 rounded">
                  <span className="text-red-300">{allergy}</span>
                  <button
                    onClick={() => removeFromArray('allergies', index)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Safety Insights */}
      {(formData.medical.currentMedications.length > 0 || formData.medical.hormoneStatus === 'pregnancy' || formData.medical.allergies.length > 0) && (
        <div className="bg-[#d4a574]/5 border border-[#d4a574]/20 rounded-lg p-6">
          <h3 className="text-lg font-medium text-[#d4a574] mb-4">Bailey's Safety Analysis</h3>
          <div className="space-y-3 text-sm">
            {formData.medical.currentMedications.some(med =>
              med.toLowerCase().includes('accutane') || med.toLowerCase().includes('isotretinoin')
            ) && (
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-red-400 rounded-full mt-2"></div>
                <p className="text-gray-300">
                  <span className="text-red-400 font-medium">Accutane Protocol:</span>
                  Bailey will exclude all retinoids and acids, focusing on gentle, hydrating products only.
                </p>
              </div>
            )}
            {(formData.medical.hormoneStatus === 'pregnancy') && (
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2"></div>
                <p className="text-gray-300">
                  <span className="text-yellow-400 font-medium">Pregnancy Safe:</span>
                  All recommendations will exclude retinoids, salicylic acid, and other pregnancy-contraindicated ingredients.
                </p>
              </div>
            )}
            {formData.medical.allergies.length > 0 && (
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-orange-400 rounded-full mt-2"></div>
                <p className="text-gray-300">
                  <span className="text-orange-400 font-medium">Allergy Protection:</span>
                  Bailey will automatically exclude your known allergens from all product recommendations.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}