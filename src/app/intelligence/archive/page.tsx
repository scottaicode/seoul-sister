'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { Calendar, TrendingUp, Lock, Search, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';

interface ReportSummary {
  id: string;
  report_date: string;
  title: string;
  subtitle: string;
  executive_summary: string;
  view_count: number;
  save_count: number;
  categories: string[];
}

export default function ReportArchivePage() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const { isPremium } = usePremiumStatus();

  const categories = [
    { id: 'all', name: 'All Reports', icon: '📊' },
    { id: 'trending', name: 'Trending', icon: '🔥' },
    { id: 'ingredients', name: 'Ingredients', icon: '🧪' },
    { id: 'social', name: 'Social', icon: '📱' },
    { id: 'predictions', name: 'Predictions', icon: '🔮' }
  ];

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/reports/archive');

      if (response.ok) {
        const data = await response.json();
        setReports(data.reports || getSampleArchive());
      } else {
        setReports(getSampleArchive());
      }
    } catch (error) {
      console.error('Error loading archive:', error);
      setReports(getSampleArchive());
    } finally {
      setLoading(false);
    }
  };

  const getSampleArchive = (): ReportSummary[] => {
    const sampleReports = [];
    const today = new Date();

    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      sampleReports.push({
        id: `report-${i}`,
        report_date: date.toISOString(),
        title: `Seoul Beauty Intelligence: ${format(date, 'MMMM d, yyyy')}`,
        subtitle: 'Exclusive insights from Korea\'s beauty capital',
        executive_summary: `Intelligence report featuring ${5 - (i % 3)} trending products, ${3 + (i % 2)} ingredient analyses, and viral trends from Korean social media.`,
        view_count: Math.floor(Math.random() * 5000) + 500,
        save_count: Math.floor(Math.random() * 200) + 20,
        categories: ['trending', 'ingredients', 'social'].slice(0, 2 + (i % 2))
      });
    }

    return sampleReports;
  };

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.executive_summary.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || report.categories.includes(selectedCategory);
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-2 border-[#D4A574] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#D4A574] text-sm uppercase tracking-wider">Loading Archive</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-[#D4A574]/20 backdrop-blur-xl bg-black/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-[#D4A574] text-xs uppercase tracking-widest mb-2">Intelligence Archive</p>
              <h1 className="text-4xl font-light tracking-wide">
                Seoul Beauty Reports
              </h1>
              <p className="text-gray-400 text-sm mt-2">
                {reports.length} reports available · Updated daily at 7 AM UTC
              </p>
            </div>
            <Link
              href="/intelligence"
              className="px-6 py-3 bg-[#D4A574] text-black text-sm uppercase tracking-wider hover:bg-[#B8956A] transition-colors"
            >
              Today's Report
            </Link>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search reports..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#0A0A0A] border border-[#D4A574]/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#D4A574]/50"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-3 rounded-lg text-sm uppercase tracking-wider whitespace-nowrap transition-all ${
                    selectedCategory === category.id
                      ? 'bg-[#D4A574] text-black'
                      : 'bg-[#0A0A0A] text-gray-400 hover:text-white border border-[#D4A574]/20'
                  }`}
                >
                  <span className="mr-2">{category.icon}</span>
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Reports Grid */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {!isPremium && (
          <div className="bg-gradient-to-r from-[#D4A574]/10 to-[#D4A574]/5 border border-[#D4A574]/30 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-light mb-2">Unlock Full Archive Access</h3>
                <p className="text-gray-400">
                  Premium members get unlimited access to all intelligence reports
                </p>
              </div>
              <Link
                href="/membership"
                className="px-6 py-3 bg-[#D4A574] text-black text-sm uppercase tracking-wider hover:bg-[#B8956A] transition-colors"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReports.map((report, index) => {
            const isLocked = !isPremium && index > 2;
            const reportDate = parseISO(report.report_date);

            return (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="relative"
              >
                <Link href={isLocked ? '/membership' : `/intelligence/reports/${report.id}`}>
                  <div className={`bg-[#0A0A0A] border border-[#D4A574]/20 rounded-lg p-6 hover:bg-[#1A1A1A] transition-all ${
                    isLocked ? 'opacity-60' : ''
                  }`}>
                    {isLocked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                        <Lock className="text-[#D4A574]" size={32} />
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2 text-[#D4A574]">
                        <Calendar size={16} />
                        <span className="text-sm">{format(reportDate, 'MMM d, yyyy')}</span>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-gray-400">
                        <span>{report.view_count.toLocaleString()} views</span>
                        <span>{report.save_count} saves</span>
                      </div>
                    </div>

                    <h3 className="text-lg font-light mb-2 line-clamp-2">
                      {report.title}
                    </h3>
                    <p className="text-gray-400 text-sm line-clamp-3 mb-4">
                      {report.executive_summary}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {report.categories.map((cat) => (
                        <span
                          key={cat}
                          className="px-2 py-1 bg-[#D4A574]/10 text-[#D4A574] text-xs uppercase tracking-wider rounded"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {filteredReports.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-400">No reports found matching your search criteria</p>
          </div>
        )}
      </main>
    </div>
  );
}