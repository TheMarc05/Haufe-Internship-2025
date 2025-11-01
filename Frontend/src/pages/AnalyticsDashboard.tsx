import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useReviewStore } from "../store/reviewStore";
import { Navbar } from "../components/layout/Navbar";
import { StatsCards } from "../components/analytics/StatsCards";
import { TopFilesTable } from "../components/analytics/TopFilesTable";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";

export const AnalyticsDashboard = () => {
  const navigate = useNavigate();
  const { dashboardStats, isLoading, fetchDashboardStats } = useReviewStore();

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Loading dashboard..." size="lg" />;
  }

  if (!dashboardStats) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            No data available
          </h1>
          <button
            onClick={() => navigate("/projects")}
            className="text-blue-600 hover:text-blue-700"
          >
            Create your first project →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 py-8 pt-20">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Analytics Dashboard
          </h1>
          <p className="text-gray-600">Overview of your code review activity</p>
        </div>

        {/* Stats Cards */}
        <div className="mb-8">
          <StatsCards stats={dashboardStats} />
        </div>

        {/* Token & Performance Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl shadow-md p-6 border border-purple-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <svg
                  className="w-6 h-6 mr-2 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Token Usage
              </h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Total Tokens</p>
                <p className="text-3xl font-bold text-purple-600">
                  {dashboardStats.totalTokens.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Average per File</p>
                <p className="text-xl font-semibold text-gray-700">
                  {dashboardStats.avgTokensPerFile.toLocaleString()} tokens
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-xl shadow-md p-6 border border-green-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <svg
                  className="w-6 h-6 mr-2 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Performance
              </h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Total Processing Time</p>
                <p className="text-3xl font-bold text-green-600">
                  {(dashboardStats.totalProcessingTime / 1000).toFixed(1)}s
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Average per Analysis</p>
                <p className="text-xl font-semibold text-gray-700">
                  {(dashboardStats.avgProcessingTime / 1000).toFixed(1)}s
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Top Files */}
        <div className="mb-8">
          <TopFilesTable files={dashboardStats.topProblematicFiles} />
        </div>

        {/* Recent Reviews */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              📋 Recent Reviews
            </h3>
          </div>
          <div className="divide-y divide-gray-200">
            {dashboardStats.recentReviews.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No reviews yet
              </div>
            ) : (
              dashboardStats.recentReviews.map((review) => (
                <div
                  key={review.id}
                  className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/review/${review.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <svg
                        className="w-8 h-8 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {review.file.filename}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {review.file.language}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {review.summary?.totalIssues || 0} issues
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
