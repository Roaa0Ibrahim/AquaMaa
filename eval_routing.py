"""Milestone 3 check: is each question routed to the right type, and does its retrieval find the right file?

Run: python eval_routing.py            (results also saved to eval_routing_v3.json)
Done when, for the 27 typed questions (3 per type):
  - the type is right for at least 25 of 27
  - a right file is in the top 3 for at least 22 of 27
(The milestone first said 24 questions, 22 and 19. A ninth type, explanation, made it 27; the shares are kept.)
"""
import json
import sys
import time

from retrieval import Retrievers
from routing import classify, retrieve

sys.stdout.reconfigure(encoding="utf-8")
TOP = 3

NPC23 = "NPC_Water_Statistics_2023.txt"
KM23 = "Kahramaa_Statistics_Report_2023.txt"
ABS = "total-abstraction-from-ground-water.csv"
WPA = "water-production-abstraction-losses-and-uses.csv"
POP = "total-population-and-population-density-by-municipality-in-census-2010-2020.csv"
BIO = "biological-water-quality-compliance-by-year.csv"
FAO = "FAO_29_Water_Quality_for_Agriculture_ch1-5.txt"
MIS, GLO, LIM, GOALS = "misconceptions.csv", "glossary.csv", "limits.csv", "policy-goals.csv"
QEERI = "QEERI_2022_Qatar_Groundwater_Challenges.txt"

# question, expected type, files that can answer it
TESTS = [
    ("What is the groundwater safe yield?", "simple", [NPC23, GLO, MIS, "PSA_Water_Statistics_2021.txt"]),
    ("What is the WHO guideline value for nitrate in drinking water?", "simple", ["WHO_GDWQ_annex_tables.txt", LIM, GLO]),
    ("What is the measurement range of the DFRobot TDS sensor?", "simple", ["DFRobot_SEN0244_TDS.txt", MIS]),

    ("What was total groundwater abstraction in 2019?", "simple_with_condition", [ABS, WPA]),
    ("What was the population of Al Rayyan in the 2020 census?", "simple_with_condition", [POP]),
    ("What was biological water quality compliance in 2021?", "simple_with_condition", [BIO]),

    ("Which national goals concern groundwater?", "set", [GOALS, "Qatar_NDS3.txt", "NPC_NDS3_Strategic_Outcomes.txt"]),
    ("Which parameters does FAO use to judge irrigation water quality?", "set", [FAO, LIM]),
    ("Which heavy metals are measured in Qatar's marine water?", "set", ["water-pollution-indicators.csv"]),

    ("Compare groundwater abstraction in 2019 and 2023.", "comparison", [ABS, WPA, KM23, NPC23]),
    ("How does the FAO irrigation TDS limit compare with the GSO drinking-water TDS limit?", "comparison", [LIM, FAO, "GSO_149_Unbottled_Drinking_Water.txt"]),
    ("Compare the population of Al Rayyan and Al Wakra in 2020.", "comparison", [POP]),

    ("What was the average groundwater abstraction from 2019 to 2024?", "aggregation", [ABS, WPA]),
    ("How many wells are there in total across all municipalities?", "aggregation", ["number-of-farms-and-wells-by-type-of-the-farm-and-municipality.csv"]),
    ("What was the average biological compliance from 2020 to 2025?", "aggregation", [BIO]),

    ("Which body owns the national goal on groundwater extraction, and what is its target?", "multi_hop", [GOALS, "Qatar_NDS3.txt", "NPC_NDS3_Strategic_Outcomes.txt"]),
    ("Which aquifers supply Qatar's groundwater, and what is their safe yield?", "multi_hop", [NPC23, GLO, "PSA_Water_Statistics_2021.txt"]),
    ("Which plan sets the target for recharge wells, and how many wells does it plan?", "multi_hop", ["Qatar_NDC_3.txt", GOALS]),

    ("How many times the safe yield is the 2023 groundwater abstraction?", "post_processing", [ABS, NPC23, MIS, GLO]),
    ("What percentage of groundwater abstraction came from farm wells in 2023?", "post_processing", [NPC23, KM23, WPA]),
    ("By what percentage did the abstraction estimate change between 2022 and 2023?", "post_processing", [ABS, KM23, MIS]),

    ("Where can we find the greatest amount of drinkable groundwater in Qatar?", "false_premise", [MIS, KM23, NPC23, QEERI]),
    ("Since pumping fell in 2023, is the aquifer recovering?", "false_premise", [MIS, KM23]),
    ("Since low TDS means water is safe, can we drink from a well with 400 mg/L TDS?", "false_premise", ["WHO_TDS_background_document.txt", MIS]),

    ("Why is Qatar's groundwater getting saltier?", "explanation", [QEERI, "Elobaid_2017_EGU_saline_front_Qatar.txt", "Fanack_Water_Resources_in_Qatar.txt", "ANND_Right_to_Water_in_Qatar.txt", NPC23]),
    ("Why does high SAR damage soil?", "explanation", [FAO, GLO]),
    ("What causes seawater intrusion in coastal aquifers?", "explanation", [QEERI, GLO, "Elobaid_2017_EGU_saline_front_Qatar.txt", "Mohieldeen_2021_GIS_aquifer_recharge_Qatar_SciRep.txt"]),

    ("What is the best recipe for machboos?", "out_of_scope", []),
]


def top_files(result):
    """Files in the top 3 of the evidence. For sub-questions, the top 3 of each step."""
    if result["method"] == "per_sub_question":
        return [f for step in result["evidence"] for f in top_files(step["result"])]
    return [hit["file"] for hit in result["evidence"][:TOP]]


def main():
    r = Retrievers()
    rows, typed_ok, file_ok, n_typed, precisions = [], 0, 0, 0, []
    for question, expected_type, expected_files in TESTS:
        start = time.time()
        route = classify(question)
        result = retrieve(route, question, r)
        got_type = result["type"]
        files = top_files(result)
        type_right = got_type == expected_type
        file_right = (not expected_files) or any(f in expected_files for f in files)
        if expected_type != "out_of_scope":
            n_typed += 1
            typed_ok += type_right
            file_ok += file_right
            precisions.append(sum(f in expected_files for f in files) / len(files) if files else 0.0)
        print(f"{'OK ' if type_right else 'XX '}{'OK ' if file_right else 'XX '} {expected_type:22} -> {got_type:22} "
              f"{result['method'] or '-':16} {time.time() - start:4.1f}s  {question[:60]}")
        if not file_right:
            print(f"        top files: {files}")
        rows.append(dict(question=question, expected_type=expected_type, got_type=got_type, method=result["method"],
                         conditions=route.conditions, sub_questions=route.sub_questions,
                         premise_issue=route.premise_issue, top_files=files,
                         type_right=type_right, file_right=file_right))
    print(f"\nType right: {typed_ok}/{n_typed} (target 25).  Right file in the top {TOP}: {file_ok}/{n_typed} (target 22).")
    print(f"Context recall (a right file found): {file_ok / n_typed:.2f}.  "
          f"Context precision (share of top {TOP} from right files): {sum(precisions) / len(precisions):.2f}.")
    json.dump(rows, open("eval_routing_v3.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
