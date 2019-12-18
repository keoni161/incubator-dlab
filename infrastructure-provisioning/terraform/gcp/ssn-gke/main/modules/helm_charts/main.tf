# *****************************************************************************
#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
#
# ******************************************************************************

data "google_container_cluster" "ssn_k8s_gke_cluster" {
  name       = var.gke_cluster_name
  location   = var.region
  depends_on = []
}

data "google_client_config" "current" {}

provider "helm" {

  kubernetes {
    host                   = data.google_container_cluster.ssn_k8s_gke_cluster.endpoint
    token                  = data.google_client_config.current.access_token
    client_certificate     = base64decode(data.google_container_cluster.ssn_k8s_gke_cluster.master_auth.0.client_certificate)
    client_key             = base64decode(data.google_container_cluster.ssn_k8s_gke_cluster.master_auth.0.client_key)
    cluster_ca_certificate = base64decode(data.google_container_cluster.ssn_k8s_gke_cluster.master_auth.0.cluster_ca_certificate)
  }
  install_tiller = true
  service_account = "tiller"
}

provider "kubernetes" {
  host = data.google_container_cluster.ssn_k8s_gke_cluster.endpoint

  client_certificate     = base64decode(data.google_container_cluster.ssn_k8s_gke_cluster.master_auth.0.client_certificate)
  client_key             = base64decode(data.google_container_cluster.ssn_k8s_gke_cluster.master_auth.0.client_key)
  cluster_ca_certificate = base64decode(data.google_container_cluster.ssn_k8s_gke_cluster.master_auth.0.cluster_ca_certificate)
}

resource "kubernetes_service_account" "example" {
  metadata {
    name = "tiller"
    namespace = "kube-system"
  }
}

resource "kubernetes_role_binding" "example" {
  metadata {
    name      = "tiller"
    namespace = "kube-system"
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = "cluster-admin"
  }
  subject {
    kind      = "ServiceAccount"
    name      = "tiller"
    namespace = "kube-system"
  }
}