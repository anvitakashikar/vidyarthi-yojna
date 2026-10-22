"""Scheme eligibility: age 18–24 AND residence in one of the listed talukas.

A student is eligible if and only if both conditions hold. The check runs when
the student saves their Aadhaar details (age is taken on that date) and the
result is stored on the student record. Students only ever see the final
status; the reasons are for admins.

Talukas are matched together with their district, because some names repeat
across districts (e.g. Malegaon is listed for Washim but not Nashik).
To change the rules, edit this file and bump RULES_VERSION — every stored
result is re-checked on the next server start.
"""
import re
from dataclasses import asdict, dataclass, field
from datetime import date
from typing import Dict, List, Optional, Tuple

RULES_VERSION = 1
MIN_AGE, MAX_AGE = 18, 24

# division → district → talukas
ELIGIBLE_TALUKAS: Dict[str, Dict[str, List[str]]] = {
    "Amravati Division": {
        "Amravati": ["Amravati", "Bhatkuli", "Chandur Railway", "Nandgaon Khandeshwar", "Dhamangaon Railway", "Achalpur",
                     "Anjangaon Surji", "Teosa", "Dharni", "Chikhaldara", "Warud", "Morshi", "Chandur Bazar", "Daryapur"],
        "Akola": ["Akot", "Akola", "Patur", "Telhara", "Murtizapur", "Balapur", "Barshitakli"],
        "Washim": ["Washim", "Risod", "Malegaon", "Mangrulpir", "Karanja", "Manora"],
        "Yavatmal": ["Yavatmal", "Babhulgaon", "Kalamb", "Darwha", "Digras", "Arni", "Ner", "Pusad", "Umarkhed", "Mahagaon",
                     "Wani", "Maregaon", "Zari Jamani", "Kelapur", "Ghatanji", "Ralegaon"],
        "Buldhana": ["Jalgaon Jamod", "Sangrampur", "Chikhli", "Deulgaon Raja", "Mehkar", "Buldhana", "Sindkhed Raja", "Lonar",
                     "Khamgaon", "Shegaon", "Malkapur", "Motala", "Nandura"],
    },
    "Nagpur & Vidarbha Division": {
        "Nagpur": ["Nagpur", "Kamthi", "Savner", "Parshivni", "Mauda", "Bhiwapur", "Kalmeshwar", "Katol", "Ramtek", "Hingna",
                   "Umred", "Kuhi", "Narkhed", "Nagpur City"],
        "Wardha": ["Wardha", "Seloo", "Deoli", "Arvi", "Samudrapur", "Hinganghat", "Ashti"],
        "Bhandara": ["Bhandara", "Pauni", "Lakhandur"],
        "Gondia": ["Tiroda", "Amgaon", "Deori", "Salekasa", "Gondia", "Arjuni Morgaon", "Sadak Arjuni", "Goregaon"],
        "Chandrapur": ["Chandrapur", "Bhadravati", "Gondpipri", "Rajura", "Korpana", "Mul", "Warora", "Sawali", "Chimur",
                       "Nagbhid", "Sindewahi", "Pombhurna"],
        "Gadchiroli": ["Gadchiroli", "Chamorshi"],
    },
    "Chhatrapati Sambhajinagar (Marathwada) Division": {
        "Dharashiv": ["Dharashiv", "Kalamb", "Bhoom", "Washi", "Tuljapur", "Lohara", "Paranda", "Omerga"],
        "Nanded": ["Nanded", "Biloli", "Kandhar", "Loha", "Hadgaon", "Bhokar", "Degloor", "Kinwat", "Himayatnagar", "Mahoor",
                   "Dharmabad", "Umri", "Ardhapur", "Naigaon"],
        "Parbhani": ["Purna", "Palam", "Parbhani", "Sonpeth", "Jintur", "Gangakhed", "Selu", "Manwath", "Pathri"],
        "Hingoli": ["Hingoli", "Aundha Nagnath", "Kalamnuri", "Sengaon", "Basmath"],
    },
    "Konkan & Palghar Division": {
        "Palghar": ["Jawhar", "Mokhada", "Talasari"],
    },
}

# Other spellings seen on Aadhaar cards and in government records
DISTRICT_ALIASES: Dict[str, List[str]] = {
    "Dharashiv": ["Osmanabad"],
    "Buldhana": ["Buldana"],
    "Gondia": ["Gondiya"],
    "Yavatmal": ["Yeotmal"],
}
TALUKA_ALIASES: Dict[Tuple[str, str], List[str]] = {
    ("Amravati", "Teosa"): ["Tiosa", "Tivsa"],
    ("Amravati", "Chandur Railway"): ["Chandur Rly", "Chandurrailway"],
    ("Amravati", "Dhamangaon Railway"): ["Dhamangaon Rly", "Dhamangaon"],
    ("Amravati", "Nandgaon Khandeshwar"): ["Nandgaon Kh", "Nandgaon"],
    ("Amravati", "Anjangaon Surji"): ["Anjangaon"],
    ("Akola", "Murtizapur"): ["Murtajapur"],
    ("Akola", "Barshitakli"): ["Barshi Takli"],
    ("Washim", "Karanja"): ["Karanja Lad"],
    ("Yavatmal", "Zari Jamani"): ["Jhari Jamani", "Zari"],
    ("Yavatmal", "Kelapur"): ["Pandharkawada"],
    ("Nagpur", "Nagpur"): ["Nagpur Rural", "Nagpur Urban"],
    ("Nagpur", "Parshivni"): ["Parseoni"],
    ("Gondia", "Arjuni Morgaon"): ["Arjuni Mor", "Arjuni"],
    ("Chandrapur", "Sawali"): ["Saoli"],
    ("Dharashiv", "Dharashiv"): ["Osmanabad"],
    ("Dharashiv", "Omerga"): ["Umarga", "Umerga"],
    ("Hingoli", "Basmath"): ["Vasmat", "Basmat", "Wasmat"],
    ("Hingoli", "Aundha Nagnath"): ["Aundha"],
}

_DISTRICT_SUFFIX = re.compile(r"\b(district|dist|jilha|zilla)\b\.?", re.I)
_TALUKA_WORDS = re.compile(r"\b(taluka|tal|tq|tehsil|tahsil)\b\.?", re.I)
_SPELLING = [("aa", "a"), ("ee", "i"), ("oo", "u"), ("w", "v"), ("z", "j"), ("ph", "f")]


def _key(name: str) -> str:
    """Spelling-tolerant comparison key: 'Degloor' == 'Deglur', 'Murtizapur' == 'Murtijapur'."""
    s = re.sub(r"[^a-z]", "", (name or "").lower())
    for old, new in _SPELLING:
        s = s.replace(old, new)
    return s


def _district_key(name: str) -> str:
    return _key(_DISTRICT_SUFFIX.sub(" ", name or ""))


# district key → (canonical district, {taluka key → canonical taluka})
_INDEX: Dict[str, Tuple[str, Dict[str, str]]] = {}
for _districts in ELIGIBLE_TALUKAS.values():
    for _district, _talukas in _districts.items():
        _lookup: Dict[str, str] = {}
        for _taluka in _talukas:
            for _name in [_taluka, *TALUKA_ALIASES.get((_district, _taluka), [])]:
                _lookup[_key(_name)] = _taluka
        for _dname in [_district, *DISTRICT_ALIASES.get(_district, [])]:
            _INDEX[_key(_dname)] = (_district, _lookup)
_ALL_TALUKA_KEYS = {k for _, lookup in _INDEX.values() for k in lookup}


@dataclass
class EligibilityResult:
    status: str                      # eligible | not_eligible | pending
    age: Optional[int] = None
    age_ok: bool = False
    taluka_ok: bool = False
    matched_district: str = ""
    matched_taluka: str = ""
    reasons: List[str] = field(default_factory=list)
    # age_below · age_above · taluka_not_listed · district_mismatch · missing_aadhaar
    checked_on: str = ""             # ISO date the age was calculated on
    rules_version: int = RULES_VERSION

    def to_dict(self) -> dict:
        return asdict(self)


def _age_on(dob: date, on: date) -> int:
    return on.year - dob.year - ((on.month, on.day) < (dob.month, dob.day))


def match_taluka(taluka: str, district: str) -> Tuple[bool, str, str, bool]:
    """Returns (listed, canonical district, canonical taluka, name listed under another district)."""
    t_key = _key(_TALUKA_WORDS.sub(" ", taluka or ""))
    entry = _INDEX.get(_district_key(district))
    if entry and t_key in entry[1]:
        return True, entry[0], entry[1][t_key], False
    return False, "", "", t_key in _ALL_TALUKA_KEYS


def evaluate(dob: Optional[date], taluka: str, district: str, on: Optional[date] = None) -> EligibilityResult:
    on = on or date.today()
    if dob is None:
        return EligibilityResult(status="pending", reasons=["missing_aadhaar"], checked_on=on.isoformat())

    age = _age_on(dob, on)
    reasons: List[str] = []
    age_ok = MIN_AGE <= age <= MAX_AGE
    if age < MIN_AGE:
        reasons.append("age_below")
    elif age > MAX_AGE:
        reasons.append("age_above")

    listed, m_district, m_taluka, elsewhere = match_taluka(taluka, district)
    if not listed:
        reasons.append("district_mismatch" if elsewhere else "taluka_not_listed")

    return EligibilityResult(
        status="eligible" if age_ok and listed else "not_eligible",
        age=age,
        age_ok=age_ok,
        taluka_ok=listed,
        matched_district=m_district,
        matched_taluka=m_taluka,
        reasons=reasons,
        checked_on=on.isoformat(),
    )


REASON_TEXT = {
    "age_below": "Age {age} is below {min_age}",
    "age_above": "Age {age} is above {max_age}",
    "taluka_not_listed": "Taluka '{taluka}' ({district}) is not in the eligible list",
    "district_mismatch": "Taluka '{taluka}' is listed, but not for district '{district}'",
    "missing_aadhaar": "Aadhaar details not submitted",
}


def describe(result: dict, taluka: str = "", district: str = "") -> str:
    """English explanation for admins and exports."""
    params = {"age": result.get("age"), "min_age": MIN_AGE, "max_age": MAX_AGE, "taluka": taluka, "district": district}
    return "; ".join(REASON_TEXT[r].format(**params) for r in result.get("reasons", []) if r in REASON_TEXT)


def rules_summary() -> dict:
    return {
        "min_age": MIN_AGE,
        "max_age": MAX_AGE,
        "divisions": [
            {"name": division, "districts": [{"name": d, "talukas": t} for d, t in districts.items()]}
            for division, districts in ELIGIBLE_TALUKAS.items()
        ],
        "total_talukas": sum(len(t) for districts in ELIGIBLE_TALUKAS.values() for t in districts.values()),
    }
