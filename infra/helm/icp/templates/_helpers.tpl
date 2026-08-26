{{- define "icp.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "icp.labels" -}}
app.kubernetes.io/name: {{ include "icp.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end -}}

{{- define "icp.selectorLabels" -}}
app.kubernetes.io/name: {{ include "icp.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/*
Peer list handed to the config generator: "<addr> <addr> ..." in ordinal
order, matching how ic-testnet's generator expects NODES.
*/}}
{{- define "icp.peerAddrs" -}}
{{- if eq .Values.addressing.mode "clusterIp" -}}
{{- $n := int .Values.replicaCount -}}
{{- $ips := slice .Values.addressing.clusterIPs 0 $n -}}
{{- join " " $ips -}}
{{- end -}}
{{- end -}}
