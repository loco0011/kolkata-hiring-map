from django.contrib import admin
from django.urls import path

admin.site.site_header = "Kolkata Hiring Map · Fetcher"
admin.site.site_title = "Fetcher admin"
admin.site.index_title = "Fetch history"

urlpatterns = [
    path("admin/", admin.site.urls),
]
