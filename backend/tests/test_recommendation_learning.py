import pytest
from ai.online_learning import OnlineLearningEngine
from ai.recommendation_engine import FashionRecommendationEngine


def test_conversion_nudge_generation():
    """Verify conversion closing nudge includes product name and VIP styling perks."""
    nudge = FashionRecommendationEngine.generate_conversion_nudge(
        product_name="Emerald Satin Maxi",
        relevant_items=[{"name": "Tailored Velvet Blazer"}, {"name": "Crystal Clutch"}],
        inquiry_count=2,
    )
    assert "Emerald Satin Maxi" in nudge
    assert "Tailored Velvet Blazer" in nudge
    assert "VIPSTYLE10" in nudge or "Express Delivery" in nudge


def test_online_learning_rewards_weighting():
    """Verify online learning engine awards higher weights for deeper purchase intent."""
    engine = OnlineLearningEngine()
    assert engine.REWARDS["repeat_inquiry"] > engine.REWARDS["search_view"]
    assert engine.REWARDS["order_purchased"] > engine.REWARDS["add_to_cart"]
    assert engine.REWARDS["add_to_cart"] > engine.REWARDS["stylist_inquiry"]


def test_learned_query_boosts():
    """Verify query-token learned boosts return matching product weights."""
    engine = OnlineLearningEngine()
    engine._query_boost_cache = {
        "silk": {"prod_123": 2.5, "prod_456": 1.0},
        "maxi": {"prod_123": 3.0},
    }
    boosts = engine.get_query_learned_boosts("silk maxi dress")
    assert boosts.get("prod_123") == 5.5
    assert boosts.get("prod_456") == 1.0


def test_learned_affinity_retrieval():
    """Verify product-to-product learned affinity pairs are sorted by score."""
    engine = OnlineLearningEngine()
    engine._affinity_cache = {
        "prod_A": {"prod_B": 4.5, "prod_C": 9.2, "prod_D": 1.1}
    }
    affinities = engine.get_learned_affinities("prod_A", limit=2)
    assert len(affinities) == 2
    assert affinities[0] == ("prod_C", 9.2)
    assert affinities[1] == ("prod_B", 4.5)
