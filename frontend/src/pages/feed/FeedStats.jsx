import React, { memo } from 'react';
import { BarChart2, Activity, Zap } from 'lucide-react';
import { colors } from '../../constants/colors';

function FeedStats({ stats, sentimentStats, topAssets }) {
  // Guard against undefined/null
  if (!stats && !sentimentStats && (!topAssets || topAssets.length === 0)) return null;

  // Ensure topAssets is an array
  const safeTopAssets = Array.isArray(topAssets) ? topAssets : [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* Market Sentiment Card */}
      {sentimentStats?.summary && (
        <div 
          className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border"
          style={{ borderColor: '#c7d2fe' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 size={18} style={{ color: '#6366f1' }} />
            <span className="text-sm font-medium" style={{ color: '#4f46e5' }}>Market Sentiment</span>
          </div>
          <div className="flex items-center justify-between">
            <span 
              className="text-2xl font-bold"
              style={{ 
                color: sentimentStats.summary.avg_sentiment > 0.1 ? '#16a34a' : 
                       sentimentStats.summary.avg_sentiment < -0.1 ? '#dc2626' : '#6b7280' 
              }}
            >
              {sentimentStats.summary.avg_sentiment > 0 ? '+' : ''}
              {(sentimentStats.summary.avg_sentiment * 100).toFixed(0)}%
            </span>
            <span 
              className="text-xs px-2 py-1 rounded-full font-medium capitalize"
              style={{ 
                backgroundColor: sentimentStats.summary.trend === 'improving' ? '#dcfce7' :
                                sentimentStats.summary.trend === 'declining' ? '#fee2e2' : '#f3f4f6',
                color: sentimentStats.summary.trend === 'improving' ? '#16a34a' :
                       sentimentStats.summary.trend === 'declining' ? '#dc2626' : '#6b7280'
              }}
            >
              {sentimentStats.summary.trend}
            </span>
          </div>
          <div className="text-xs mt-2" style={{ color: '#6b7280' }}>
            {sentimentStats.summary.event_count || 0} events in 24h
          </div>
        </div>
      )}
      
      {/* Sentiment Distribution */}
      {sentimentStats?.sentiment_distribution && (
        <div 
          className="bg-white rounded-2xl p-4 border"
          style={{ borderColor: colors.border }}
        >
          <div className="text-sm font-medium mb-3" style={{ color: colors.text }}>Distribution</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-16 text-xs" style={{ color: '#16a34a' }}>Positive</span>
              <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div 
                  className="h-full rounded-full"
                  style={{ 
                    width: `${sentimentStats.sentiment_distribution.positive_pct || 0}%`,
                    backgroundColor: '#16a34a'
                  }}
                />
              </div>
              <span className="text-xs font-medium w-8 text-right">
                {sentimentStats.sentiment_distribution.positive_pct?.toFixed(0) || 0}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-16 text-xs" style={{ color: '#6b7280' }}>Neutral</span>
              <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div 
                  className="h-full rounded-full"
                  style={{ 
                    width: `${sentimentStats.sentiment_distribution.neutral_pct || 0}%`,
                    backgroundColor: '#6b7280'
                  }}
                />
              </div>
              <span className="text-xs font-medium w-8 text-right">
                {sentimentStats.sentiment_distribution.neutral_pct?.toFixed(0) || 0}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-16 text-xs" style={{ color: '#dc2626' }}>Negative</span>
              <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div 
                  className="h-full rounded-full"
                  style={{ 
                    width: `${sentimentStats.sentiment_distribution.negative_pct || 0}%`,
                    backgroundColor: '#dc2626'
                  }}
                />
              </div>
              <span className="text-xs font-medium w-8 text-right">
                {sentimentStats.sentiment_distribution.negative_pct?.toFixed(0) || 0}%
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Top Assets Sentiment */}
      {safeTopAssets.length > 0 && (
        <div 
          className="col-span-2 bg-white rounded-2xl p-4 border"
          style={{ borderColor: colors.border }}
        >
          <div className="text-sm font-medium mb-3" style={{ color: colors.text }}>Top Assets Sentiment</div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {safeTopAssets.slice(0, 6).map((asset, i) => (
              <div 
                key={asset.asset || i}
                className="flex-shrink-0 px-3 py-2 rounded-xl text-center"
                style={{ 
                  backgroundColor: asset.sentiment_label === 'positive' ? '#dcfce7' :
                                  asset.sentiment_label === 'negative' ? '#fee2e2' : '#f3f4f6',
                  minWidth: '70px'
                }}
              >
                <div 
                  className="font-bold text-sm"
                  style={{ 
                    color: asset.sentiment_label === 'positive' ? '#16a34a' :
                           asset.sentiment_label === 'negative' ? '#dc2626' : '#374151'
                  }}
                >
                  {asset.asset}
                </div>
                <div 
                  className="text-xs font-medium"
                  style={{ 
                    color: asset.sentiment_label === 'positive' ? '#16a34a' :
                           asset.sentiment_label === 'negative' ? '#dc2626' : '#6b7280'
                  }}
                >
                  {asset.avg_sentiment > 0 ? '+' : ''}{(asset.avg_sentiment * 100).toFixed(0)}%
                </div>
                <div className="text-[10px]" style={{ color: '#9ca3af' }}>
                  {asset.event_count} news
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(FeedStats);
