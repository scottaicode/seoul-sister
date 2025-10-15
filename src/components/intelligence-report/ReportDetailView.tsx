'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Clock, Share2, Bookmark, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { useBehaviorTracking } from '@/hooks/useBehaviorTracking';

interface ReportSection {
  id: string;
  section_type: string;
  title: string;
  content: string;
  order_index: number;
  metadata?: any;
}

interface Report {
  id: string;
  title: string;
  summary: string;
  content: string;
  published_at: string;
  author: string;
  category: string;
  tags: string[];
  featured_image_url?: string;
  reading_time_minutes: number;
  intelligence_report_sections: ReportSection[];
}

interface ReportDetailViewProps {
  report: Report;
  isPremium: boolean;
}

export default function ReportDetailView({ report, isPremium }: ReportDetailViewProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [readingProgress, setReadingProgress] = useState(0);
  const { trackDealView, startTimer, stopTimer } = useBehaviorTracking();

  useEffect(() => {
    // Track report view
    trackDealView(report.id, 'intelligence_report', {
      timeSpent: 0,
      authenticityScore: 100,
      isBestDeal: true
    });

    // Start reading timer
    startTimer();

    // Track reading progress
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (scrollTop / docHeight) * 100;
      setReadingProgress(Math.min(100, Math.max(0, progress)));
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      // Track time spent reading
      const timeSpent = stopTimer();
      if (timeSpent > 10) { // Only track if user spent meaningful time
        trackDealView(report.id, 'intelligence_report', {
          timeSpent,
          authenticityScore: 100,
          isBestDeal: true
        });
      }
    };
  }, [report.id, trackDealView, startTimer, stopTimer]);

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const sortedSections = report.intelligence_report_sections?.sort(
    (a, b) => a.order_index - b.order_index
  ) || [];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Reading Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1 bg-gray-800 z-50">
        <div
          className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-all duration-300"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      {/* Navigation */}
      <div className="border-b border-gray-800 bg-black/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link
            href="/intelligence"
            className="inline-flex items-center text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Intelligence Reports
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4 text-sm text-gray-400">
              <span className="bg-yellow-600/20 text-yellow-400 px-3 py-1 rounded-full">
                {report.category}
              </span>
              <div className="flex items-center">
                <Calendar size={14} className="mr-1" />
                {formatDate(report.published_at)}
              </div>
              <div className="flex items-center">
                <Clock size={14} className="mr-1" />
                {report.reading_time_minutes} min read
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
                <Bookmark size={18} />
              </button>
              <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
                <Share2 size={18} />
              </button>
            </div>
          </div>

          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            {report.title}
          </h1>

          <p className="text-xl text-gray-300 leading-relaxed mb-6">
            {report.summary}
          </p>

          <div className="text-sm text-gray-500">
            By <span className="text-gray-300">{report.author}</span>
          </div>

          {report.tags && report.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {report.tags.map((tag, index) => (
                <span
                  key={index}
                  className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* Featured Image */}
        {report.featured_image_url && (
          <div className="mb-8 rounded-lg overflow-hidden border border-gray-800">
            <img
              src={report.featured_image_url}
              alt={report.title}
              className="w-full h-64 object-cover"
            />
          </div>
        )}

        {/* Main Content */}
        <article className="prose prose-invert prose-lg max-w-none">
          <div
            className="text-gray-300 leading-relaxed space-y-6"
            dangerouslySetInnerHTML={{ __html: report.content }}
          />
        </article>

        {/* Report Sections */}
        {sortedSections.length > 0 && (
          <div className="mt-12 space-y-6">
            <h2 className="text-2xl font-bold text-white border-b border-gray-800 pb-2">
              Detailed Analysis
            </h2>

            {sortedSections.map((section) => (
              <div
                key={section.id}
                className="border border-gray-800 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full px-6 py-4 text-left bg-gray-900/50 hover:bg-gray-900 transition-colors flex items-center justify-between"
                >
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {section.title}
                    </h3>
                    <span className="text-sm text-gray-400 capitalize">
                      {section.section_type.replace('_', ' ')}
                    </span>
                  </div>

                  {expandedSections.has(section.id) ? (
                    <ChevronUp size={20} className="text-gray-400" />
                  ) : (
                    <ChevronDown size={20} className="text-gray-400" />
                  )}
                </button>

                {expandedSections.has(section.id) && (
                  <div className="px-6 py-4 bg-black/20">
                    <div
                      className="prose prose-invert max-w-none text-gray-300"
                      dangerouslySetInnerHTML={{ __html: section.content }}
                    />

                    {section.metadata && (
                      <div className="mt-4 p-4 bg-gray-900/50 rounded-lg">
                        <pre className="text-sm text-gray-400 overflow-x-auto">
                          {JSON.stringify(section.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Related Intelligence */}
        <div className="mt-16 p-6 bg-gradient-to-r from-gray-900/50 to-gray-800/50 rounded-lg border border-gray-700">
          <h3 className="text-xl font-bold text-white mb-4">
            Continue Your Intelligence Journey
          </h3>
          <p className="text-gray-300 mb-4">
            Access more exclusive Korean beauty intelligence, market analysis, and insider discoveries.
          </p>
          <Link
            href="/intelligence"
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-yellow-600 to-yellow-500 text-black font-medium rounded-lg hover:from-yellow-500 hover:to-yellow-400 transition-all"
          >
            View All Reports
            <ArrowLeft size={16} className="ml-2 rotate-180" />
          </Link>
        </div>
      </div>
    </div>
  );
}