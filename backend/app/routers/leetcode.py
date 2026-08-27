"""
CampusOS Backend - LeetCode Integration Router
Queries official LeetCode GraphQL API with TTL caching, URL parsing,
placement readiness scoring, and company target gap analysis.
"""

import logging
import re
import time
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import requests
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger("vtop.routes.leetcode")

router = APIRouter(prefix="/api/leetcode", tags=["leetcode"])

# 15-minute in-memory TTL Cache
_CACHE: Dict[str, Dict[str, Any]] = {}
CACHE_TTL_SECONDS = 15 * 60

COMPANY_BENCHMARKS = {
    "google": {
        "name": "Google",
        "minMedium": 220,
        "minHard": 65,
        "minTotal": 450,
        "minRating": 1950,
        "keyTopics": ["Dynamic Programming", "Graph", "Trie"],
    },
    "meta": {
        "name": "Meta",
        "minMedium": 250,
        "minHard": 50,
        "minTotal": 420,
        "minRating": 1900,
        "keyTopics": ["Binary Tree", "Recursion", "Hash Table"],
    },
    "amazon": {
        "name": "Amazon",
        "minMedium": 180,
        "minHard": 35,
        "minTotal": 320,
        "minRating": 1750,
        "keyTopics": ["Array", "Dynamic Programming", "Breadth-First Search"],
    },
    "microsoft": {
        "name": "Microsoft",
        "minMedium": 160,
        "minHard": 30,
        "minTotal": 300,
        "minRating": 1700,
        "keyTopics": ["Linked List", "Tree", "Depth-First Search"],
    },
    "atlassian": {
        "name": "Atlassian",
        "minMedium": 190,
        "minHard": 40,
        "minTotal": 350,
        "minRating": 1850,
        "keyTopics": ["Design", "Heap (Priority Queue)", "Graph"],
    },
    "uber": {
        "name": "Uber",
        "minMedium": 210,
        "minHard": 55,
        "minTotal": 400,
        "minRating": 1920,
        "keyTopics": ["Graph", "Topological Sort", "Backtracking"],
    },
}


def parse_leetcode_username(raw: str) -> Optional[str]:
    if not raw or not isinstance(raw, str):
        return None
    val = raw.strip().lstrip("@")
    if val.startswith("http://") or val.startswith("https://"):
        try:
            parsed = urlparse(val)
            parts = [p for p in parsed.path.strip("/").split("/") if p]
            if not parts:
                return None
            if parts[0] == "u" and len(parts) >= 2:
                val = parts[1]
            else:
                val = parts[0]
        except Exception:
            pass

    match = re.match(r"^[a-zA-Z0-9_-]{1,30}$", val)
    return match.group(0) if match else None


def calculate_placement_readiness(
    easy: int, medium: int, hard: int, total: int, contest_rating: float, topic_count: int
) -> Dict[str, Any]:
    # Volume Score (0-25)
    volume_score = min(25.0, (total / 450.0) * 25.0)

    # Quality / Difficulty Score (0-35)
    quality_metric = (medium * 1.2) + (hard * 2.8)
    quality_score = min(35.0, (quality_metric / 260.0) * 35.0)

    # Contest Rating Score (0-25)
    if contest_rating >= 2150:
        contest_score = 25.0
    elif contest_rating >= 1950:
        contest_score = 22.0
    elif contest_rating >= 1800:
        contest_score = 18.0
    elif contest_rating >= 1650:
        contest_score = 14.0
    elif contest_rating >= 1500:
        contest_score = 10.0
    else:
        contest_score = min(15.0, hard * 0.4)

    # Topic Breadth Score (0-15)
    topic_score = min(15.0, (topic_count / 12.0) * 15.0)

    final_score = min(100, round(volume_score + quality_score + contest_score + topic_score))

    if final_score >= 85:
        tier = "Super Dream / Tier-1 Ready"
        tier_color = "#10b981"
        description = "Interview ready for top product companies: Google, Meta, Uber, Atlassian."
    elif final_score >= 70:
        tier = "Dream Product Ready"
        tier_color = "#38bdf8"
        description = "Strong candidacy for Amazon, Microsoft, Oracle, Cisco, and top unicorns."
    elif final_score >= 55:
        tier = "Core Product Ready"
        tier_color = "#f59e0b"
        description = "Competitive for ServiceNow, Samsung, Zoho, and Fintech engineering."
    else:
        tier = "Foundation Phase"
        tier_color = "#94a3b8"
        description = "Focus on building core problem volume and Medium-level fundamentals."

    return {
        "finalScore": final_score,
        "tier": tier,
        "tierColor": tier_color,
        "description": description,
    }


@router.get("/profile")
def get_leetcode_profile(
    user: Optional[str] = Query(None),
    username: Optional[str] = Query(None),
):
    raw = user or username
    if not raw:
        raise HTTPException(
            status_code=400,
            detail="Missing required parameter 'user'. Example: ?user=tourist or ?user=https://leetcode.com/u/tourist/",
        )

    parsed_username = parse_leetcode_username(raw)
    if not parsed_username:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid username format: '{raw}'. Enter a valid LeetCode handle or profile link.",
        )

    cache_key = parsed_username.lower()
    cached = _CACHE.get(cache_key)
    now = time.time()
    if cached and (now - cached["timestamp"]) < CACHE_TTL_SECONDS:
        cached_data = dict(cached["data"])
        cached_data["cached"] = True
        return cached_data

    graphql_query = """
    query getFullUserProfile($username: String!) {
      allQuestionsCount {
        difficulty
        count
      }
      matchedUser(username: $username) {
        username
        profile {
          realName
          userAvatar
          ranking
          reputation
          starRating
          aboutMe
          school
          countryName
        }
        badges {
          id
          displayName
          icon
          creationDate
        }
        submitStats {
          acSubmissionNum {
            difficulty
            count
            submissions
          }
        }
        tagProblemCounts {
          advanced {
            tagName
            problemsSolved
          }
          intermediate {
            tagName
            problemsSolved
          }
          fundamental {
            tagName
            problemsSolved
          }
        }
      }
      userContestRanking(username: $username) {
        attendedContestsCount
        rating
        globalRanking
        totalParticipants
        topPercentage
        badge {
          name
        }
      }
      userContestRankingHistory(username: $username) {
        attended
        rating
        ranking
        contest {
          title
          startTime
        }
      }
    }
    """

    try:
        resp = requests.post(
            "https://leetcode.com/graphql",
            json={"query": graphql_query, "variables": {"username": parsed_username}},
            headers={
                "Content-Type": "application/json",
                "Referer": "https://leetcode.com",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CampusOS-Intelligence/2.0",
            },
            timeout=12,
        )
    except Exception as exc:
        logger.error("LeetCode network failure: %s", exc)
        raise HTTPException(status_code=504, detail="Timeout communicating with LeetCode GraphQL API.")

    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"LeetCode upstream returned HTTP {resp.status_code}",
        )

    try:
        body = resp.json()
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to parse LeetCode upstream JSON response.")

    data = body.get("data") or {}
    matched_user = data.get("matchedUser")
    if not matched_user:
        raise HTTPException(
            status_code=404,
            detail=f"LeetCode user '{parsed_username}' was not found. Please verify the handle.",
        )

    all_questions = data.get("allQuestionsCount") or []
    platform_totals = {}
    for q in all_questions:
        platform_totals[q.get("difficulty")] = q.get("count", 0)

    solved = {"Easy": 0, "Medium": 0, "Hard": 0, "All": 0}
    for item in (matched_user.get("submitStats") or {}).get("acSubmissionNum", []):
        diff = item.get("difficulty")
        if diff in solved:
            solved[diff] = item.get("count", 0)

    # Consolidate topic mastery
    tag_map: Dict[str, int] = {}
    for sec in ["fundamental", "intermediate", "advanced"]:
        for t in (matched_user.get("tagProblemCounts") or {}).get(sec, []):
            name = t.get("tagName")
            if name:
                tag_map[name] = tag_map.get(name, 0) + t.get("problemsSolved", 0)

    topic_mastery = [{"topic": k, "count": v} for k, v in tag_map.items()]
    topic_mastery.sort(key=lambda x: x["count"], reverse=True)

    # Dynamic Weak Spot Detection
    benchmarks = [
        ("Dynamic Programming", 35),
        ("Graph", 25),
        ("Tree", 30),
        ("Binary Search", 20),
        ("Backtracking", 15),
        ("Heap (Priority Queue)", 15),
    ]
    weak_spots = []
    for topic_name, target in benchmarks:
        user_c = tag_map.get(topic_name, 0)
        if user_c < target:
            weak_spots.append(
                {
                    "topic": topic_name,
                    "solved": user_c,
                    "recommended": target,
                    "gap": target - user_c,
                    "message": f"{topic_name} is below Tier-1 standard ({user_c}/{target} solved)",
                }
            )

    contest_data = data.get("userContestRanking") or {}
    contest_rating = float(contest_data.get("rating") or 0)
    attended_count = int(contest_data.get("attendedContestsCount") or 0)

    # 3-step action plan
    first_weak = weak_spots[0]["topic"] if weak_spots else None
    action_plan = [
        (
            f"Bridge biggest gap: Solve 5 Medium problems in {first_weak}."
            if first_weak
            else "Maintain excellence: Solve 1 Hard problem daily in Advanced Graphs."
        ),
        (
            f"Increase problem hardness: You have solved {solved['Hard']}/30 recommended Hard problems."
            if solved["Hard"] < 30
            else "Target top 5% finish in this week's live LeetCode contest."
        ),
        (
            "Attend at least 3 live Weekly/Biweekly Contests to establish a competitive rating."
            if attended_count < 5
            else "Practice timed mock interview assessments (45-minute limit per Medium/Hard)."
        ),
    ]

    # Contest History
    contest_history_raw = data.get("userContestRankingHistory") or []
    contest_history = []
    for c in contest_history_raw:
        if c.get("attended"):
            c_info = c.get("contest") or {}
            start_time = c_info.get("startTime", 0)
            date_str = time.strftime("%b %d", time.gmtime(start_time)) if start_time else ""
            contest_history.append(
                {
                    "title": c_info.get("title", "Contest"),
                    "date": date_str,
                    "rating": round(float(c.get("rating", 0))),
                    "rank": c.get("ranking", 0),
                }
            )
    contest_history = contest_history[-15:]

    # Placement Readiness Score
    readiness = calculate_placement_readiness(
        easy=solved["Easy"],
        medium=solved["Medium"],
        hard=solved["Hard"],
        total=solved["All"],
        contest_rating=contest_rating,
        topic_count=len(topic_mastery),
    )

    # Company simulations
    company_simulations = []
    for key, b in COMPANY_BENCHMARKS.items():
        med_pct = min(100.0, (solved["Medium"] / b["minMedium"]) * 100.0) if b["minMedium"] else 100.0
        hard_pct = min(100.0, (solved["Hard"] / b["minHard"]) * 100.0) if b["minHard"] else 100.0
        total_pct = min(100.0, (solved["All"] / b["minTotal"]) * 100.0) if b["minTotal"] else 100.0
        match_score = round((med_pct * 0.45) + (hard_pct * 0.35) + (total_pct * 0.20))
        company_simulations.append(
            {
                "id": key,
                "name": b["name"],
                "matchScore": min(100, match_score),
                "benchmark": b,
                "mediumGap": max(0, b["minMedium"] - solved["Medium"]),
                "hardGap": max(0, b["minHard"] - solved["Hard"]),
                "totalGap": max(0, b["minTotal"] - solved["All"]),
            }
        )

    profile_obj = matched_user.get("profile") or {}
    badge_obj = contest_data.get("badge") or {}

    result = {
        "username": matched_user.get("username"),
        "realName": profile_obj.get("realName") or matched_user.get("username"),
        "avatar": profile_obj.get("userAvatar") or "https://assets.leetcode.com/users/default_avatar.jpg",
        "ranking": profile_obj.get("ranking") or "N/A",
        "reputation": profile_obj.get("reputation") or 0,
        "badges": matched_user.get("badges") or [],
        "solved": solved,
        "platformTotals": platform_totals,
        "contest": {
            "attended": attended_count,
            "rating": round(contest_rating),
            "globalRanking": contest_data.get("globalRanking") or "Unrated",
            "topPercentage": f"{float(contest_data.get('topPercentage')):.1f}" if contest_data.get("topPercentage") else None,
            "badge": badge_obj.get("name") if isinstance(badge_obj, dict) else None,
            "history": contest_history,
        },
        "topicMastery": topic_mastery[:12],
        "weakSpots": weak_spots[:3],
        "actionPlan": action_plan,
        "readiness": readiness,
        "companySimulations": company_simulations,
    }

    _CACHE[cache_key] = {"timestamp": now, "data": result}
    return result
