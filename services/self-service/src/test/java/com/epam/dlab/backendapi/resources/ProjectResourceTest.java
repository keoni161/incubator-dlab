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

package com.epam.dlab.backendapi.resources;

import com.epam.dlab.auth.UserInfo;
import com.epam.dlab.backendapi.resources.dto.KeysDTO;
import com.epam.dlab.backendapi.resources.dto.ProjectActionFormDTO;
import com.epam.dlab.backendapi.service.AccessKeyService;
import com.epam.dlab.backendapi.service.ProjectService;
import com.epam.dlab.exceptions.DlabException;
import io.dropwizard.auth.AuthenticationException;
import io.dropwizard.testing.junit.ResourceTestRule;
import org.apache.http.HttpStatus;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;

import javax.ws.rs.client.Entity;
import javax.ws.rs.core.HttpHeaders;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.util.Collections;

import static org.junit.Assert.assertEquals;
import static org.mockito.Matchers.any;
import static org.mockito.Mockito.anyList;
import static org.mockito.Mockito.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;


public class ProjectResourceTest extends TestBase {
    private ProjectService projectService = mock(ProjectService.class);
    private AccessKeyService keyService = mock(AccessKeyService.class);

    @Rule
    public final ResourceTestRule resources = getResourceTestRuleInstance(
            new ProjectResource(projectService, keyService));

    @Before
    public void setup() throws AuthenticationException {
        authSetup();
    }

    @Test
    public void stopProject() {
        final Response response = resources.getJerseyTest()
                .target("project/stop")
                .request()
                .header("Authorization", "Bearer " + TOKEN)
                .post(Entity.json(getProjectActionDTO()));

        assertEquals(HttpStatus.SC_ACCEPTED, response.getStatus());
        verify(projectService).stopWithResources(any(UserInfo.class), anyList(), anyString());
        verifyNoMoreInteractions(projectService);
    }

    @Test
    public void startProject() {
        final Response response = resources.getJerseyTest()
                .target("project/start")
                .request()
                .header("Authorization", "Bearer " + TOKEN)
                .post(Entity.json(getProjectActionDTO()));

        assertEquals(HttpStatus.SC_ACCEPTED, response.getStatus());
        verify(projectService).start(any(UserInfo.class), anyList(), anyString());
        verifyNoMoreInteractions(projectService);
    }

    @Test
    public void generate() {
        when(keyService.generateKeys(any(UserInfo.class))).thenReturn(new KeysDTO("somePublicKey", "somePrivateKey",
                "user"));

        final Response response = resources.getJerseyTest()
                .target("/project/keys")
                .request()
                .header("Authorization", "Bearer " + TOKEN)
                .post(Entity.json(""));

        assertEquals(HttpStatus.SC_OK, response.getStatus());
        assertEquals(MediaType.APPLICATION_JSON, response.getHeaderString(HttpHeaders.CONTENT_TYPE));

        verify(keyService).generateKeys(getUserInfo());
        verifyNoMoreInteractions(keyService);
    }

    @Test
    public void generateKeysWithException() {
        doThrow(new DlabException("Can not generate private/public key pair due to"))
                .when(keyService).generateKeys(any(UserInfo.class));

        final Response response = resources.getJerseyTest()
                .target("/project/keys")
                .request()
                .header("Authorization", "Bearer " + TOKEN)
                .post(Entity.json(""));

        assertEquals(HttpStatus.SC_INTERNAL_SERVER_ERROR, response.getStatus());
        assertEquals(MediaType.APPLICATION_JSON, response.getHeaderString(HttpHeaders.CONTENT_TYPE));

        verify(keyService).generateKeys(getUserInfo());
        verifyNoMoreInteractions(keyService);
    }

    private ProjectActionFormDTO getProjectActionDTO() {
        return new ProjectActionFormDTO("DLAB", Collections.singletonList("https://localhost:8083/"));
    }
}
