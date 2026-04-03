import frappe


@frappe.whitelist()
def dismiss(name: str):
    """Delete a single notification by its document name."""
    doc = frappe.get_doc("HD Notification", name)
    if doc.user_to != frappe.session.user:
        frappe.throw("Not permitted", frappe.PermissionError)
    frappe.delete_doc("HD Notification", name, ignore_permissions=True)


@frappe.whitelist()
def delete_all():
    """Delete all notifications for the current user."""
    names = frappe.get_all(
        "HD Notification",
        filters={"user_to": frappe.session.user},
        pluck="name",
    )
    for name in names:
        frappe.delete_doc("HD Notification", name, ignore_permissions=True)
    frappe.db.commit()


@frappe.whitelist()
def clear(ticket: str | int | None = None, comment: str | None = None):
    """
    Mark notifications as read. No arguments will clear all notifications for `user`.

    :param ticket: Ticket to clear notifications for
    :param comment: Comment to clear notifications for
    """
    filters = {"user_to": frappe.session.user, "read": False}
    if ticket:
        filters["reference_ticket"] = ticket
    if comment:
        filters["reference_comment"] = comment
    for notification in frappe.get_all(
        "HD Notification", filters=filters, pluck="name"
    ):
        frappe.db.set_value(
            "HD Notification", notification, "read", 1, update_modified=False
        )
