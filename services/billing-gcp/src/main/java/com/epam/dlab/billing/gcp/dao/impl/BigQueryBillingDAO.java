/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package com.epam.dlab.billing.gcp.dao.impl;

import com.epam.dlab.billing.gcp.dao.BillingDAO;
import com.epam.dlab.billing.gcp.model.GcpBillingData;
import com.google.cloud.bigquery.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

@Component
public class BigQueryBillingDAO implements BillingDAO {

    public final String tableName;

    private static final String QUERY = "SELECT b.sku.description usageType,TIMESTAMP_TRUNC(usage_start_time, DAY, 'UTC') usage_date_from, TIMESTAMP_TRUNC(usage_end_time, DAY, 'UTC') usage_date_to, sum(b.cost) cost, b.service.description product, label.value, currency\n" +
            "FROM `" + "%s" + "` b\n" +
            "CROSS JOIN UNNEST(b.labels) as label\n" +
            "where label.key = 'name' and cost != 0 and label.value like @ssnBaseName\n" +
            "group by usageType, usage_date_from, usage_date_to, product, value, currency";
    private final BigQuery service = BigQueryOptions.getDefaultInstance().getService();

    public BigQueryBillingDAO(@Value("${tableName}") String tableName) {
        this.tableName = tableName;
    }

    @Override
    public List<GcpBillingData> getBillingData(String ssnBaseName) throws InterruptedException {
        QueryJobConfiguration queryConfig = QueryJobConfiguration.newBuilder(String.format(QUERY, tableName))
                .addNamedParameter("ssnBaseName", QueryParameterValue.string(ssnBaseName + "%"))
                .addNamedParameter("dataset", QueryParameterValue.string(tableName))
                .build();
        return StreamSupport.stream(service.query(queryConfig).getValues().spliterator(), false)
                .map(this::toBillingData)
                .collect(Collectors.toList());
    }

    private GcpBillingData toBillingData(FieldValueList fields) {

        return GcpBillingData.builder()
                .usageDateFrom(toLocalDate(fields, "usage_date_from"))
                .usageDateTo(toLocalDate(fields, "usage_date_to"))
                .cost(fields.get("cost").getNumericValue())
                .product(fields.get("product").getStringValue())
                .usageType(fields.get("usageType").getStringValue())
                .currency(fields.get("currency").getStringValue())
                .tag(fields.get("value").getStringValue()).build();
    }

    private LocalDate toLocalDate(FieldValueList fieldValues, String timestampFieldName) {
        return LocalDate.from(Instant.ofEpochMilli(fieldValues.get(timestampFieldName).getTimestampValue() / 1000)
                .atZone(ZoneId.systemDefault()));
    }
}