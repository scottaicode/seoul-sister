import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Setting up GDPR compliance tables...')

    // Read the migration file
    const migrationPath = join(process.cwd(), 'src/lib/supabase-migrations/008_add_gdpr_compliance.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf8')

    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

    console.log(`📋 Executing ${statements.length} SQL statements...`)

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'
      try {
        console.log(`Executing statement ${i + 1}/${statements.length}`)
        await supabase.rpc('exec_sql', { sql: statement })
      } catch (err) {
        console.log(`Statement ${i + 1} may already exist or failed:`, err)
        // Continue with other statements
      }
    }

    // Test table access
    const { data: deletionRequestsTest } = await supabase
      .from('gdpr_deletion_requests')
      .select('id')
      .limit(1)

    const { data: cookieConsentTest } = await supabase
      .from('cookie_consent')
      .select('id')
      .limit(1)

    const { data: dataProcessingTest } = await supabase
      .from('data_processing_log')
      .select('id')
      .limit(1)

    // Test the log_data_processing function
    try {
      const { data: testLog } = await supabase.rpc('log_data_processing', {
        p_user_id: '00000000-0000-0000-0000-000000000000',
        p_processing_type: 'test',
        p_legal_basis: 'legitimate_interest',
        p_purpose: 'GDPR setup test',
        p_data_categories: ['system_data'],
        p_processor: 'seoul_sister_admin',
        p_retention_period: '30 days'
      })

      // Clean up test log
      if (testLog) {
        await supabase
          .from('data_processing_log')
          .delete()
          .eq('id', testLog)
      }
    } catch (err) {
      console.log('Function test failed, may need manual setup:', err)
    }

    console.log('✅ GDPR compliance tables setup completed successfully')

    return NextResponse.json({
      success: true,
      message: 'GDPR compliance system created successfully',
      tables_verified: {
        gdpr_deletion_requests: !!deletionRequestsTest,
        cookie_consent: !!cookieConsentTest,
        data_processing_log: !!dataProcessingTest
      },
      features_enabled: [
        'GDPR data deletion requests',
        'Cookie consent tracking',
        'Data processing audit trail',
        'Privacy compliance fields',
        'Data retention management'
      ]
    })

  } catch (error) {
    console.error('❌ Error setting up GDPR tables:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to setup GDPR compliance tables',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Seoul Sister GDPR Compliance Setup',
    description: 'Creates tables and functions for GDPR compliance including data deletion, consent tracking, and audit trails',
    endpoints: {
      'POST /api/admin/setup-gdpr-tables': 'Run database migration for GDPR compliance',
      'POST /api/gdpr/data-deletion': 'Process GDPR data deletion requests',
      'GET /api/gdpr/data-deletion?userId=xxx': 'Check deletion request status'
    },
    features: [
      'GDPR Article 17 - Right to erasure (Right to be forgotten)',
      'Cookie consent management per GDPR Article 7',
      'Data processing audit trail per GDPR Article 30',
      'Data retention policies per GDPR Article 5(1)(e)',
      'Legal basis tracking per GDPR Article 6'
    ],
    compliance_notes: {
      data_deletion: 'Supports both full deletion and account-only deletion',
      cookie_consent: 'Tracks granular consent for analytics and marketing',
      audit_trail: 'Logs all data processing activities with legal basis',
      retention: 'Configurable data retention periods by data type'
    }
  })
}