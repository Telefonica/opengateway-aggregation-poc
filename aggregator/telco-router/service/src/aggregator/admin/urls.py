from django.urls import path

from aggregator.admin.views import ApplicationsView, ApplicationView

urlpatterns = [
    path('/apps', ApplicationsView.as_view(), name='applications'),
    path('/apps/<str:client_id>', ApplicationView.as_view(), name='application'),
]
