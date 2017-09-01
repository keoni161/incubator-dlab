/*
 * Copyright (c) 2017, EPAM SYSTEMS INC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.epam.dlab.dto.azure;

import com.epam.dlab.dto.ResourceSysBaseDTO;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.google.common.base.MoreObjects;

public class AzureResource<T extends AzureResource<?>> extends ResourceSysBaseDTO<T> {
    @JsonProperty("azure_region")
    private String azureRegion;
    @JsonProperty("aws_iam_user")
    private String azureIamUser;

    @SuppressWarnings("unchecked")
    private final T self = (T)this;

    public String getAzureRegion() {
        return azureRegion;
    }

    public T withAzureRegion(String azureRegion) {
        this.azureRegion = azureRegion;
        return self;
    }

    public String getAzureIamUser() {
        return azureIamUser;
    }

    public T withAzureIamUser(String azureIamUser) {
        this.azureIamUser = azureIamUser;
        return self;
    }

    @Override
    public MoreObjects.ToStringHelper toStringHelper(Object self) {
        return MoreObjects.toStringHelper(self)
                .add("azureRegion", azureRegion)
                .add("azureIamUser", azureIamUser);
    }

    @Override
    public String toString() {
        return toStringHelper(this).toString();
    }
}
