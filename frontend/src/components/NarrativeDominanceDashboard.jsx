import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, Target, Activity, Users, ChevronRight, 
  RefreshCw, BarChart2, Zap, ExternalLink
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Design System Colors
const colors = {
  background: '#ffffff',
  surface: '#f7f8fb',
  surfaceHover: '#f0f2f5',
  border: '#e7e9ee',
  text: '#0f172a',
  textSecondary: '#64748b',
  accent: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444'
};

// Tier Badge Component
const TierBadge = ({ tier }) => {
  const tierColors = {
    S: { bg: '#fef3c7', text: '#d97706', border: '#fcd34d' },
    A: { bg: '#dbeafe', text: '#2563eb', border: '#93c5fd' },
    B: { bg: '#d1fae5', text: '#059669', border: '#6ee7b7' },
    C: { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' },
    D: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' }
  };
  
  const color = tierColors[tier] || tierColors.C;
  
  return (
    <span style={{
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '600',
      backgroundColor: color.bg,
      color: color.text,
      border: `1px solid ${color.border}`
    }}>
      {tier}
    </span>
  );
};

// Score Bar Component
const ScoreBar = ({ score, maxScore = 100, color = colors.accent }) => {
  const percentage = Math.min((score / maxScore) * 100, 100);
  
  return (
    <div style={{
      width: '100%',
      height: '6px',
      backgroundColor: colors.border,
      borderRadius: '3px',
      overflow: 'hidden'
    }}>
      <div style={{
        width: `${percentage}%`,
        height: '100%',
        backgroundColor: color,
        borderRadius: '3px',
        transition: 'width 0.3s ease'
      }} />
    </div>
  );
};

// Narrative Card Component
const NarrativeCard = ({ narrative, onClick }) => {
  const hasLeader = narrative.leader && narrative.leader_score > 0;
  
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: colors.surface,
        borderRadius: '12px',
        padding: '16px',
        border: `1px solid ${colors.border}`,
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = narrative.color || colors.accent;
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = colors.border;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
      data-testid={`narrative-card-${narrative.id}`}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <span style={{ fontSize: '24px' }}>{narrative.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ 
            fontWeight: '600', 
            color: colors.text,
            fontSize: '14px'
          }}>
            {narrative.name}
          </div>
          <div style={{ fontSize: '12px', color: colors.textSecondary }}>
            {narrative.keywords?.slice(0, 3).join(', ')}
          </div>
        </div>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: narrative.color || colors.accent
        }} />
      </div>
      
      {/* Leader Info */}
      {hasLeader ? (
        <div style={{
          backgroundColor: colors.background,
          borderRadius: '8px',
          padding: '10px',
          marginTop: '8px'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '6px'
          }}>
            <span style={{ 
              fontSize: '12px', 
              color: colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Leader
            </span>
            <span style={{
              fontSize: '13px',
              fontWeight: '600',
              color: narrative.color || colors.accent
            }}>
              {narrative.leader_score.toFixed(1)}
            </span>
          </div>
          <div style={{ 
            fontWeight: '600', 
            color: colors.text,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            {narrative.leader}
            <span style={{
              fontSize: '11px',
              color: colors.textSecondary,
              backgroundColor: colors.surface,
              padding: '2px 6px',
              borderRadius: '4px'
            }}>
              {narrative.leader_type}
            </span>
          </div>
          <div style={{ marginTop: '8px' }}>
            <ScoreBar score={narrative.leader_score} color={narrative.color} />
          </div>
        </div>
      ) : (
        <div style={{
          backgroundColor: colors.surface,
          borderRadius: '8px',
          padding: '10px',
          marginTop: '8px',
          textAlign: 'center',
          color: colors.textSecondary,
          fontSize: '12px'
        }}>
          No leader detected
        </div>
      )}
    </div>
  );
};

// Top Entity Row Component
const TopEntityRow = ({ entity, rank, onEntityClick }) => {
  return (
    <div
      onClick={() => onEntityClick?.(entity)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        backgroundColor: rank <= 3 ? colors.surface : colors.background,
        borderBottom: `1px solid ${colors.border}`,
        cursor: 'pointer',
        transition: 'background-color 0.2s'
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.surfaceHover}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = rank <= 3 ? colors.surface : colors.background}
      data-testid={`top-entity-${entity.entity_id}`}
    >
      {/* Rank */}
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        backgroundColor: rank === 1 ? '#fef3c7' : rank === 2 ? '#f3f4f6' : rank === 3 ? '#fef3c7' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: '700',
        fontSize: '14px',
        color: rank <= 3 ? colors.text : colors.textSecondary,
        marginRight: '12px'
      }}>
        {rank}
      </div>
      
      {/* Entity Info */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: '600', color: colors.text }}>
            {entity.label || entity.entity_id}
          </span>
          <TierBadge tier={entity.tier} />
        </div>
        <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '2px' }}>
          {entity.entity_type} • {entity.narratives?.slice(0, 2).join(', ') || 'No narratives'}
        </div>
      </div>
      
      {/* Scores */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: colors.textSecondary }}>Score</div>
          <div style={{ fontWeight: '700', color: colors.accent }}>{entity.score?.toFixed(1)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: colors.textSecondary }}>Momentum</div>
          <div style={{ fontWeight: '600', color: entity.momentum > 50 ? colors.success : colors.textSecondary }}>
            {entity.momentum?.toFixed(1)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: colors.textSecondary }}>Activity</div>
          <div style={{ fontWeight: '600', color: entity.activity_level > 50 ? colors.warning : colors.textSecondary }}>
            {entity.activity_level?.toFixed(1)}
          </div>
        </div>
        <ChevronRight size={16} color={colors.textSecondary} />
      </div>
    </div>
  );
};

// Main Component
export default function NarrativeDominanceDashboard() {
  const [narratives, setNarratives] = useState([]);
  const [topEntities, setTopEntities] = useState([]);
  const [mostActive, setMostActive] = useState([]);
  const [selectedNarrative, setSelectedNarrative] = useState(null);
  const [narrativeLeaders, setNarrativeLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      
      const [narrativesRes, topRes, activeRes] = await Promise.all([
        fetch(`${API_URL}/api/intelligence/narratives`).then(r => r.json()),
        fetch(`${API_URL}/api/intelligence/top?limit=15`).then(r => r.json()),
        fetch(`${API_URL}/api/intelligence/most-active?limit=10`).then(r => r.json())
      ]);
      
      if (narrativesRes.ok) setNarratives(narrativesRes.narratives || []);
      if (topRes.ok) setTopEntities(topRes.entities || []);
      if (activeRes.ok) setMostActive(activeRes.entities || []);
      
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  
  // Fetch narrative leaders when narrative is selected
  const fetchNarrativeLeaders = useCallback(async (narrativeId) => {
    try {
      const res = await fetch(`${API_URL}/api/intelligence/narrative/${narrativeId}?limit=10`);
      const data = await res.json();
      if (data.ok) {
        setNarrativeLeaders(data.leaders || []);
      }
    } catch (error) {
      console.error('Error fetching narrative leaders:', error);
    }
  }, []);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  useEffect(() => {
    if (selectedNarrative) {
      fetchNarrativeLeaders(selectedNarrative.id);
    }
  }, [selectedNarrative, fetchNarrativeLeaders]);
  
  const handleNarrativeClick = (narrative) => {
    setSelectedNarrative(narrative);
  };
  
  const handleEntityClick = (entity) => {
    // Could navigate to entity detail page or open modal
    console.log('Entity clicked:', entity);
  };
  
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        height: '400px',
        color: colors.textSecondary
      }}>
        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ marginLeft: '12px' }}>Loading intelligence data...</span>
      </div>
    );
  }
  
  return (
    <div style={{ padding: '24px', backgroundColor: colors.background }} data-testid="narrative-dominance-dashboard">
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div>
          <h1 style={{ 
            fontSize: '24px', 
            fontWeight: '700', 
            color: colors.text,
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <Target size={28} color={colors.accent} />
            Narrative Dominance
          </h1>
          <p style={{ 
            color: colors.textSecondary, 
            margin: '8px 0 0 0',
            fontSize: '14px'
          }}>
            Track which entities lead each market narrative
          </p>
        </div>
        
        <button
          onClick={fetchData}
          disabled={refreshing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            cursor: refreshing ? 'not-allowed' : 'pointer',
            color: colors.text,
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
          data-testid="refresh-button"
        >
          <RefreshCw 
            size={16} 
            style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} 
          />
          Refresh
        </button>
      </div>
      
      {/* Main Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 400px',
        gap: '24px'
      }}>
        {/* Left: Narratives Grid */}
        <div>
          <h2 style={{ 
            fontSize: '16px', 
            fontWeight: '600', 
            color: colors.text,
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <BarChart2 size={18} />
            Active Narratives ({narratives.length})
          </h2>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px'
          }}>
            {narratives.map(narrative => (
              <NarrativeCard 
                key={narrative.id}
                narrative={narrative}
                onClick={() => handleNarrativeClick(narrative)}
              />
            ))}
          </div>
        </div>
        
        {/* Right: Top Entities & Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Selected Narrative Detail */}
          {selectedNarrative && (
            <div style={{
              backgroundColor: colors.surface,
              borderRadius: '12px',
              padding: '20px',
              border: `2px solid ${selectedNarrative.color || colors.accent}`
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                marginBottom: '16px'
              }}>
                <span style={{ fontSize: '32px' }}>{selectedNarrative.icon}</span>
                <div>
                  <h3 style={{ 
                    margin: 0, 
                    fontWeight: '700',
                    color: colors.text
                  }}>
                    {selectedNarrative.name}
                  </h3>
                  <p style={{ 
                    margin: '4px 0 0 0', 
                    fontSize: '13px',
                    color: colors.textSecondary
                  }}>
                    {selectedNarrative.keywords?.join(', ')}
                  </p>
                </div>
              </div>
              
              {/* Leaders in this narrative */}
              <div style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '12px' }}>
                TOP LEADERS
              </div>
              {narrativeLeaders.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {narrativeLeaders.slice(0, 5).map((leader, idx) => (
                    <div 
                      key={leader.entity_key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        backgroundColor: colors.background,
                        borderRadius: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                          fontWeight: '700', 
                          color: idx === 0 ? selectedNarrative.color : colors.textSecondary,
                          width: '20px'
                        }}>
                          {idx + 1}
                        </span>
                        <span style={{ fontWeight: '500', color: colors.text }}>
                          {leader.label || leader.entity_id}
                        </span>
                      </div>
                      <span style={{ 
                        fontWeight: '600', 
                        color: selectedNarrative.color || colors.accent 
                      }}>
                        {leader.total_score?.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  color: colors.textSecondary,
                  padding: '20px'
                }}>
                  No entities found for this narrative
                </div>
              )}
            </div>
          )}
          
          {/* Top Entities by Intelligence Score */}
          <div style={{
            backgroundColor: colors.surface,
            borderRadius: '12px',
            overflow: 'hidden',
            border: `1px solid ${colors.border}`
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <TrendingUp size={18} color={colors.accent} />
              <h3 style={{ margin: 0, fontWeight: '600', color: colors.text }}>
                Top Intelligence Score
              </h3>
            </div>
            
            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
              {topEntities.slice(0, 10).map((entity, idx) => (
                <TopEntityRow 
                  key={entity.entity_key}
                  entity={entity}
                  rank={idx + 1}
                  onEntityClick={handleEntityClick}
                />
              ))}
            </div>
          </div>
          
          {/* Most Active */}
          <div style={{
            backgroundColor: colors.surface,
            borderRadius: '12px',
            overflow: 'hidden',
            border: `1px solid ${colors.border}`
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Zap size={18} color={colors.warning} />
              <h3 style={{ margin: 0, fontWeight: '600', color: colors.text }}>
                Most Active (30d)
              </h3>
            </div>
            
            <div>
              {mostActive.slice(0, 5).map((entity, idx) => (
                <div
                  key={entity.entity_key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 20px',
                    borderBottom: `1px solid ${colors.border}`
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ 
                      fontWeight: '700', 
                      color: colors.textSecondary,
                      width: '20px'
                    }}>
                      {idx + 1}
                    </span>
                    <span style={{ fontWeight: '500', color: colors.text }}>
                      {entity.entity_id}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Activity size={14} color={colors.warning} />
                    <span style={{ fontWeight: '600', color: colors.warning }}>
                      {entity.total_score?.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* CSS Animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
