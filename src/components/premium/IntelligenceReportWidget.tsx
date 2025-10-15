'use client';

import Link from 'next/link';

interface Report {
  id: string;
  title: string;
  subtitle: string;
  report_date: string;
  executive_summary: string;
  trending_discoveries: any[];
  view_count: number;
}

interface IntelligenceReportWidgetProps {
  reports: Report[];
  showAll?: boolean;
}

export default function IntelligenceReportWidget({ reports, showAll = false }: IntelligenceReportWidgetProps) {
  const displayReports = showAll ? reports : reports.slice(0, 3);

  return (
    <div className="bg-luxury-black-soft border border-luxury-gold border-opacity-20 p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-luxury-gold text-xs uppercase tracking-wider mb-2">MARKET INTELLIGENCE</p>
          <h3 className="text-2xl font-light text-white">
            {showAll ? 'Intelligence Reports' : 'Latest Intelligence'}
          </h3>
        </div>
        <Link
          href="/intelligence"
          className="text-luxury-gold text-sm uppercase tracking-wider hover:text-white transition-colors duration-300"
        >
          VIEW ALL →
        </Link>
      </div>

      {displayReports.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-luxury-gray">
            Intelligence reports are generated daily. Check back soon for the latest Korean beauty insights.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {displayReports.map((report, index) => (
            <div
              key={report.id}
              className={`${index === 0 && !showAll ? 'border-2 border-luxury-gold border-opacity-30' : 'border border-luxury-gold border-opacity-10'} p-6 hover:border-opacity-40 transition-all duration-300`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    {index === 0 && !showAll && (
                      <span className="bg-luxury-gold text-black px-2 py-1 text-xs uppercase tracking-wider font-medium">
                        LATEST
                      </span>
                    )}
                    <span className="text-luxury-gray text-sm">
                      {new Date(report.report_date).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <h4 className="text-white text-lg font-light mb-2">
                    {report.title}
                  </h4>
                  <p className="text-luxury-gray text-sm mb-4">
                    {report.subtitle}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-luxury-gold text-sm">
                    {report.view_count} views
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-luxury-gray text-sm leading-relaxed">
                  {report.executive_summary.substring(0, 200)}
                  {report.executive_summary.length > 200 && '...'}
                </p>
              </div>

              {report.trending_discoveries && report.trending_discoveries.length > 0 && (
                <div className="mb-6">
                  <p className="text-luxury-gold text-xs uppercase tracking-wider mb-3">
                    TRENDING DISCOVERIES
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {report.trending_discoveries.slice(0, 2).map((discovery: any, idx: number) => (
                      <div key={idx} className="bg-luxury-black p-3 border border-luxury-gold border-opacity-10">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white text-sm font-light">
                              {discovery.productName}
                            </p>
                            <p className="text-luxury-gray text-xs">
                              {discovery.brand}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-luxury-gold text-sm">
                              ${discovery.seoulPrice}
                            </p>
                            <p className="text-luxury-gray text-xs line-through">
                              ${discovery.usPrice}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-luxury-gray uppercase tracking-wider">
                  <span>🔥 {report.trending_discoveries?.length || 0} PRODUCTS</span>
                  <span>🧪 INGREDIENT ANALYSIS</span>
                  <span>📱 SOCIAL INSIGHTS</span>
                  <span>🗣️ REDDIT INTELLIGENCE</span>
                </div>
                <Link
                  href={`/intelligence/${report.id}`}
                  className="text-luxury-gold text-sm uppercase tracking-wider hover:text-white transition-colors duration-300 border border-luxury-gold border-opacity-30 px-4 py-2 hover:border-opacity-100"
                >
                  READ FULL REPORT →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-luxury-gold border-opacity-10">
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-luxury-gold text-xl font-light">
              {reports.length}
            </div>
            <p className="text-luxury-gray text-xs uppercase tracking-wider">
              REPORTS AVAILABLE
            </p>
          </div>
          <div>
            <div className="text-luxury-gold text-xl font-light">
              {reports.reduce((sum, report) => sum + (report.trending_discoveries?.length || 0), 0)}
            </div>
            <p className="text-luxury-gray text-xs uppercase tracking-wider">
              PRODUCTS ANALYZED
            </p>
          </div>
          <div>
            <div className="text-luxury-gold text-xl font-light">
              {reports.reduce((sum, report) => sum + report.view_count, 0)}
            </div>
            <p className="text-luxury-gray text-xs uppercase tracking-wider">
              TOTAL VIEWS
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}