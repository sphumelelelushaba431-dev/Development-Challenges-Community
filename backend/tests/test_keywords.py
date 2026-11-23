from app.nlp.classify import classify
from app.nlp.keywords import extract, stem


def top_area(title, desc):
    r = classify(desc, title)
    return r["stage"], (r["areas"][0]["area"] if r["areas"] else None)


def test_stemming():
    assert stem("monitoring") == stem("monitored") == stem("monitors")


def test_domain_phrase_and_synonyms():
    assert top_area("Reduce queues at the campus clinic", "Patients wait hours; nurses want a calmer waiting room.") == ("exact", "Health & Community Wellbeing")
    assert top_area("Phone charging", "Traders need to charge phones during load shedding using PV panels.")[1] == "Renewable Energy & Sustainability"
    assert top_area("Spaza shop help", "Spaza shops struggle to track money and need accounting support.")[1] == "Entrepreneurship & Small Business Support"


def test_phrase_words_not_double_counted():
    r = classify("Flag students at risk using machine learning on attendance data.", "Dropout early-warning dashboard")
    assert [a["area"] for a in r["areas"]] == ["Data Science & Machine Learning"]


def test_negation():
    kws = {k["term"] for k in extract("This is not a software project. We need a baseline survey of residents.", "Survey")["keywords"]}
    assert "software" not in kws
    assert top_area("Survey", "This is not a software project. We need a baseline survey of residents.")[1] == "Research"


def test_related_and_none():
    assert top_area("Help our elders", "Older residents feel lonely and isolated; we want wellness check-ins.") == ("related", "Health & Community Wellbeing")
    assert top_area("Something", "We would like help with things.") == ("none", None)


def test_ahp_weights_consistent():
    from app.config import Config
    from app.mcda import ahp_weights
    w, cr = ahp_weights(Config.MCDA_AHP_PAIRWISE)
    assert cr < 0.10 and abs(sum(w.values()) - 1) < 1e-3 and w["alignment"] > w["capacity"] > w["record"]


def test_topsis_prefers_better_candidate():
    from app.mcda import topsis
    w = {"alignment": 0.5, "capacity": 0.25, "availability": 0.15, "record": 0.1}
    good = {"alignment": 1, "capacity": 0.7, "availability": 1, "record": 0.9}
    weak = {"alignment": 0.4, "capacity": 0.3, "availability": 1, "record": 0.6}
    a, b = topsis([good, weak], w)
    assert a > b
