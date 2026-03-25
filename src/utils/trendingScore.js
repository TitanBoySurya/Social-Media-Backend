const calculateTrendingScore = (post) => {
  const { views_count = 0, likes_count = 0, comments_count = 0, created_at } = post;
  
  // Kitna purana hai (Freshness)
  const hoursOld = (Date.now() - new Date(created_at)) / (1000 * 60 * 60);
  
  // Engagement Score
  const engagement = (likes_count * 3) + (comments_count * 5);
  
  // Score Formula (Fresh videos ko boost milega)
  const freshness = 1 / (hoursOld + 2); 
  return (views_count + engagement) * freshness;
};

module.exports = calculateTrendingScore;