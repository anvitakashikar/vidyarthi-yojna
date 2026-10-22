"""Central list of MongoDB collection names.

Placeholders for now — rename / add as features are defined.
"""


class Collections:
    USERS = "users"
    STUDENTS = "students"
    DONORS = "donors"
    SCHEMES = "schemes"            # yojna / scholarship schemes
    APPLICATIONS = "applications"  # student applications to schemes
    DOCUMENTS = "documents"        # uploaded document metadata
    NOTIFICATIONS = "notifications"
    FUNDS = "funds"                # money received
    PAYMENTS = "payments"          # monthly payouts to students
    DONATIONS = "donations"        # donor donations (each has a receipt)
    COUNTERS = "counters"          # sequential receipt numbers
