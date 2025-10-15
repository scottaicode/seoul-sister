import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const body = await request.json();

    const {
      userId,
      targetReportId,
      agreesWithReport,
      expertiseLevel,
      confidence,
      additionalNotes,
      hasSimilarExperience
    } = body;

    // Validate required fields
    if (!userId || !targetReportId || agreesWithReport === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: userId, targetReportId, agreesWithReport'
      }, { status: 400 });
    }

    // Check if user already verified this report
    const { data: existingVerification, error: checkError } = await supabase
      .from('community_verifications')
      .select('id')
      .eq('user_id', userId)
      .eq('target_report_id', targetReportId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw new Error(`Failed to check existing verification: ${checkError.message}`);
    }

    if (existingVerification) {
      return NextResponse.json({
        success: false,
        error: 'User has already verified this report'
      }, { status: 400 });
    }

    // Get the target report
    const { data: targetReport, error: reportError } = await supabase
      .from('authenticity_reports')
      .select('*')
      .eq('id', targetReportId)
      .single();

    if (reportError) {
      throw new Error(`Failed to fetch target report: ${reportError.message}`);
    }

    // Insert community verification
    const { data: verification, error: insertError } = await (supabase as any)
      .from('community_verifications')
      .insert({
        user_id: userId,
        target_report_id: targetReportId,
        agrees_with_report: agreesWithReport,
        expertise_level: expertiseLevel || 3,
        confidence: confidence || 3,
        additional_notes: additionalNotes || null,
        has_similar_experience: hasSimilarExperience || false
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to insert verification: ${insertError.message}`);
    }

    // Update community votes on the original report
    await updateCommunityVotes(supabase, targetReportId);

    // Calculate and update community consensus
    const consensus = await calculateCommunityConsensus(supabase, targetReportId);

    return NextResponse.json({
      success: true,
      verification,
      consensus,
      message: 'Community verification submitted successfully'
    });

  } catch (error) {
    console.error('Error submitting community verification:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('reportId');
    const userId = searchParams.get('userId');
    const action = searchParams.get('action') || 'get_verifications';

    const supabase = createClient();

    switch (action) {
      case 'get_verifications':
        if (!reportId) {
          return NextResponse.json({
            success: false,
            error: 'reportId is required for get_verifications'
          }, { status: 400 });
        }
        return await getReportVerifications(supabase, reportId);

      case 'get_pending_reports':
        return await getPendingReports(supabase, userId || undefined);

      case 'get_consensus':
        if (!reportId) {
          return NextResponse.json({
            success: false,
            error: 'reportId is required for get_consensus'
          }, { status: 400 });
        }
        return await getConsensusData(supabase, reportId);

      case 'get_user_contributions':
        if (!userId) {
          return NextResponse.json({
            success: false,
            error: 'userId is required for get_user_contributions'
          }, { status: 400 });
        }
        return await getUserContributions(supabase, userId!);

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Available: get_verifications, get_pending_reports, get_consensus, get_user_contributions'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in community verification GET:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

async function updateCommunityVotes(supabase: any, reportId: string) {
  // Get all verifications for this report
  const { data: verifications, error } = await supabase
    .from('community_verifications')
    .select('agrees_with_report, expertise_level, confidence')
    .eq('target_report_id', reportId);

  if (error) {
    throw new Error(`Failed to fetch verifications: ${error.message}`);
  }

  // Get the original report to know what it claimed
  const { data: originalReport, error: reportError } = await supabase
    .from('authenticity_reports')
    .select('is_authentic')
    .eq('id', reportId)
    .single();

  if (reportError) {
    throw new Error(`Failed to fetch original report: ${reportError.message}`);
  }

  // Calculate weighted votes
  let authenticVotes = 0;
  let counterfeitVotes = 0;

  verifications.forEach((verification: any) => {
    // Weight by expertise and confidence
    const weight = (verification.expertise_level * verification.confidence) / 25; // Normalize to 0-1

    if (verification.agrees_with_report) {
      // Agrees with original report
      if (originalReport.is_authentic) {
        authenticVotes += weight;
      } else {
        counterfeitVotes += weight;
      }
    } else {
      // Disagrees with original report
      if (originalReport.is_authentic) {
        counterfeitVotes += weight;
      } else {
        authenticVotes += weight;
      }
    }
  });

  // Update the original report with community votes
  const { error: updateError } = await supabase
    .from('authenticity_reports')
    .update({
      community_votes_authentic: Math.round(authenticVotes * 10) / 10, // Round to 1 decimal
      community_votes_counterfeit: Math.round(counterfeitVotes * 10) / 10
    })
    .eq('id', reportId);

  if (updateError) {
    throw new Error(`Failed to update community votes: ${updateError.message}`);
  }
}

async function calculateCommunityConsensus(supabase: any, reportId: string) {
  const { data: report, error } = await supabase
    .from('authenticity_reports')
    .select('*')
    .eq('id', reportId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch report for consensus: ${error.message}`);
  }

  const totalVotes = report.community_votes_authentic + report.community_votes_counterfeit;

  if (totalVotes < 3) {
    return {
      status: 'insufficient_data',
      confidence: 0,
      consensus_authentic: null,
      total_votes: totalVotes,
      required_votes: 3
    };
  }

  const authenticPercentage = (report.community_votes_authentic / totalVotes) * 100;
  const consensusAuthentic = authenticPercentage >= 60; // 60% threshold for consensus
  const confidence = Math.min(95, Math.max(
    Math.abs(authenticPercentage - 50) * 2, // Higher confidence when further from 50/50
    totalVotes * 10 // Confidence increases with more votes
  ));

  // Determine if this contradicts the original report
  const contradictsOriginal = consensusAuthentic !== report.is_authentic;

  return {
    status: confidence >= 70 ? 'strong_consensus' : 'weak_consensus',
    confidence: Math.round(confidence),
    consensus_authentic: consensusAuthentic,
    authentic_percentage: Math.round(authenticPercentage),
    total_votes: totalVotes,
    contradicts_original: contradictsOriginal,
    should_flag_for_review: contradictsOriginal && confidence >= 80
  };
}

async function getReportVerifications(supabase: any, reportId: string) {
  const { data: verifications, error } = await supabase
    .from('community_verifications')
    .select('*')
    .eq('target_report_id', reportId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch verifications: ${error.message}`);
  }

  const consensus = await calculateCommunityConsensus(supabase, reportId);

  return NextResponse.json({
    success: true,
    verifications: verifications.map((v: any) => ({
      id: v.id,
      agrees_with_report: v.agrees_with_report,
      expertise_level: v.expertise_level,
      confidence: v.confidence,
      additional_notes: v.additional_notes,
      has_similar_experience: v.has_similar_experience,
      created_at: v.created_at,
      user_id_masked: v.user_id?.substring(0, 8) + '***' // Privacy protection
    })),
    consensus,
    total_verifications: verifications.length
  });
}

async function getPendingReports(supabase: any, userId?: string) {
  // Get reports that need more community verification
  const { data: reports, error } = await supabase
    .from('authenticity_reports')
    .select(`
      *,
      price_retailers (name, domain)
    `)
    .lt('community_votes_authentic + community_votes_counterfeit', 5) // Need more votes
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`Failed to fetch pending reports: ${error.message}`);
  }

  // If userId provided, filter out reports they've already verified
  let filteredReports = reports;
  if (userId) {
    const { data: userVerifications, error: verificationError } = await supabase
      .from('community_verifications')
      .select('target_report_id')
      .eq('user_id', userId);

    if (!verificationError) {
      const verifiedReportIds = new Set(userVerifications.map((v: any) => v.target_report_id));
      filteredReports = reports.filter((r: any) => !verifiedReportIds.has(r.id));
    }
  }

  return NextResponse.json({
    success: true,
    pending_reports: filteredReports.map((report: any) => ({
      ...report,
      current_votes: report.community_votes_authentic + report.community_votes_counterfeit,
      votes_needed: Math.max(0, 5 - (report.community_votes_authentic + report.community_votes_counterfeit))
    })),
    total_pending: filteredReports.length
  });
}

async function getConsensusData(supabase: any, reportId: string) {
  const consensus = await calculateCommunityConsensus(supabase, reportId);

  const { data: report, error } = await supabase
    .from('authenticity_reports')
    .select(`
      *,
      price_retailers (name, domain)
    `)
    .eq('id', reportId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch report: ${error.message}`);
  }

  return NextResponse.json({
    success: true,
    report,
    consensus,
    community_impact: {
      improves_accuracy: consensus.confidence >= 70,
      flags_potential_error: consensus.contradicts_original,
      strengthens_data: consensus.total_votes >= 3
    }
  });
}

async function getUserContributions(supabase: any, userId: string) {
  const { data: contributions, error } = await supabase
    .from('community_verifications')
    .select(`
      *,
      authenticity_reports (
        product_id,
        is_authentic,
        price_retailers (name)
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch user contributions: ${error.message}`);
  }

  // Calculate user stats
  const totalContributions = contributions.length;
  const avgExpertise = contributions.reduce((sum: number, c: any) => sum + c.expertise_level, 0) / totalContributions;
  const avgConfidence = contributions.reduce((sum: number, c: any) => sum + c.confidence, 0) / totalContributions;

  // Calculate accuracy (would need to compare with eventual consensus)
  const recentContributions = contributions.filter((c: any) =>
    new Date(c.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  ).length;

  return NextResponse.json({
    success: true,
    user_stats: {
      total_contributions: totalContributions,
      recent_contributions: recentContributions,
      avg_expertise_level: Math.round(avgExpertise * 10) / 10,
      avg_confidence: Math.round(avgConfidence * 10) / 10,
      reputation_score: Math.min(100, totalContributions * 5 + avgExpertise * 10),
      community_rank: totalContributions >= 10 ? 'Expert Verifier' :
                     totalContributions >= 5 ? 'Active Contributor' :
                     totalContributions >= 1 ? 'Community Member' : 'New User'
    },
    recent_contributions: contributions.slice(0, 10),
    total_contributions: totalContributions
  });
}