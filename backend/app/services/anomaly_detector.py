import math
from typing import List, Dict, Any, Tuple

def calculate_baseline_stats(historical_hourly_volumes: List[int]) -> Tuple[float, float]:
    """
    Calculate baseline mean and standard deviation from historical counts.
    Returns (mean, std).
    """
    if not historical_hourly_volumes:
        return 10.0, 3.0  # Safe default baseline
    
    n = len(historical_hourly_volumes)
    mean = sum(historical_hourly_volumes) / float(n)
    if n < 2:
        return mean, 2.0
    
    variance = sum((x - mean) ** 2 for x in historical_hourly_volumes) / float(n - 1)
    std = math.sqrt(variance)
    return max(mean, 1.0), max(std, 1.0)

def evaluate_surge(
    current_volume: int,
    historical_volumes: List[int],
    multiplier_threshold: float = 3.0
) -> Dict[str, Any]:
    """
    Evaluate if current volume represents an anomalous surge.
    Returns surge decision, z-score, growth ratio, and reasoning.
    """
    mean, std = calculate_baseline_stats(historical_volumes)
    growth_ratio = round(current_volume / mean, 2)
    z_score = round((current_volume - mean) / std, 2)
    
    is_surge = (growth_ratio >= multiplier_threshold) or (z_score >= 3.0)
    
    alasan = (
        f"Lonjakan volume {growth_ratio}x dibanding baseline normal ({mean:.1f} konten/jam). "
        f"Z-score: {z_score:.2f}."
    )
    if is_surge:
        alasan += f" Ambang {multiplier_threshold}x terlewati."

    return {
        "is_surge": is_surge,
        "current_volume": current_volume,
        "baseline_mean": round(mean, 1),
        "baseline_std": round(std, 2),
        "growth_ratio": growth_ratio,
        "z_score": z_score,
        "alasan": alasan,
    }
