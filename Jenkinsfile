pipeline {
    agent any

    tools {
        nodejs("Node 22")
    }

    environment {
        SERVER_IP    = credentials('SERVER_IP')
        IMAGE_NAME   = 'johnogama19/daybook-backend'
        IMAGE_TAG    = "${BUILD_NUMBER}"
        PROJECT_PATH = '/home/jogama/projects/daybook'
    }

    stages {
        stage('Github Clone') {
            steps {
                checkout scmGit(
                    branches: [[name: '*/main']],
                    extensions: [],
                    userRemoteConfigs: [[
                        credentialsId: 'JENKINS_GITHUB_PRIVATE_KEY',
                        url: 'git@github.com:JohnOGama/daybook.git'
                    ]]
                )
            }
        }

        stage('Install Dependencies + Build') {
            steps {
                sh 'corepack pnpm install --frozen-lockfile --filter api...'
                sh 'corepack pnpm --filter api build'
            }
        }

        stage('Database Migration') {
            steps {
                withCredentials([string(credentialsId: 'DAYBOOK_DATABASE_URL', variable: 'DATABASE_URL')]) {
                    sh 'corepack pnpm --filter api db:migrate'
                }
            }
        }

        stage('Server Testing') {
            steps {
                sh 'corepack pnpm --filter api test'
            }
        }

        stage('Copy Docker compose and Nginx') {
            steps {
                withCredentials([sshUserPrivateKey(
                    credentialsId: 'UBUNTU_SERVER_SSH_KEY',
                    keyFileVariable: 'UBUNTU_SSH_KEY',
                    usernameVariable: 'UBUNTU_USERNAME'
                )]) {
                    sh '''
                        # Everything lives under the project folder so it never
                        # collides with another project's deploy-docker.sh.
                        ssh -i "$UBUNTU_SSH_KEY" \
                            "$UBUNTU_USERNAME@$SERVER_IP" \
                            "mkdir -p $PROJECT_PATH/scripts $PROJECT_PATH/temp"

                        scp -i "$UBUNTU_SSH_KEY" \
                            ./apps/api/server/scripts/deploy-docker.sh \
                            "$UBUNTU_USERNAME@$SERVER_IP:$PROJECT_PATH/scripts/"

                        ssh -i "$UBUNTU_SSH_KEY" \
                            "$UBUNTU_USERNAME@$SERVER_IP" \
                            "chmod +x $PROJECT_PATH/scripts/deploy-docker.sh"

                        scp -i "$UBUNTU_SSH_KEY" \
                            ./apps/api/server/docker/docker-compose.yml \
                            "$UBUNTU_USERNAME@$SERVER_IP:$PROJECT_PATH"

                        scp -i "$UBUNTU_SSH_KEY" \
                            ./apps/api/server/nginx/daybook-production.conf \
                            ./apps/api/server/nginx/daybook-staging.conf \
                            "$UBUNTU_USERNAME@$SERVER_IP:$PROJECT_PATH/temp"

                        ssh -i "$UBUNTU_SSH_KEY" \
                            "$UBUNTU_USERNAME@$SERVER_IP" \
                            "sudo mv $PROJECT_PATH/temp/daybook-production.conf /etc/nginx/sites-available/daybook-production && \
                            sudo mv $PROJECT_PATH/temp/daybook-staging.conf /etc/nginx/sites-available/daybook-staging && \
                            sudo ln -sfn /etc/nginx/sites-available/daybook-production /etc/nginx/sites-enabled/daybook-production && \
                            sudo ln -sfn /etc/nginx/sites-available/daybook-staging /etc/nginx/sites-enabled/daybook-staging && \
                            sudo nginx -t && \
                            sudo systemctl reload nginx"
                    '''
                }
            }
        }

        stage('Login to Docker') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'DOCKER_HUB_CREDS',
                    passwordVariable: 'DOCKER_PSW',
                    usernameVariable: 'DOCKER_USR'
                )]) {
                    sh 'echo "$DOCKER_PSW" | docker login -u "$DOCKER_USR" --password-stdin'
                }
            }
        }

        stage('Docker Build + Push') {
            steps {
                sh '''
                    docker build -f apps/api/Dockerfile -t $IMAGE_NAME:$IMAGE_TAG .
                    docker push $IMAGE_NAME:$IMAGE_TAG
                '''
            }
        }

        stage('Nginx revalidate') {
            steps {
                withCredentials([sshUserPrivateKey(
                    credentialsId: 'UBUNTU_SERVER_SSH_KEY',
                    keyFileVariable: 'UBUNTU_SSH_KEY',
                    usernameVariable: 'UBUNTU_USERNAME'
                )]) {
                    sh '''
                        ssh -i "$UBUNTU_SSH_KEY" "$UBUNTU_USERNAME@$SERVER_IP" \
                            "sudo nginx -t && sudo systemctl reload nginx"
                    '''
                }
            }
        }

        stage('SSH To Server + Docker Pull') {
            steps {
                withCredentials([sshUserPrivateKey(
                    credentialsId: 'UBUNTU_SERVER_SSH_KEY',
                    keyFileVariable: 'UBUNTU_SSH_KEY',
                    usernameVariable: 'UBUNTU_USERNAME'
                )]) {
                    sh '''
                        ssh -i "$UBUNTU_SSH_KEY" "$UBUNTU_USERNAME@$SERVER_IP" \
                            "IMAGE_TAG=$IMAGE_TAG $PROJECT_PATH/scripts/deploy-docker.sh"
                    '''
                }
            }
        }
    }

    post {
        always  { echo '===== Pipeline Finished ====='; sh 'docker logout' }
        success { echo '===== Pipeline Successful =====' }
        failure { echo '===== Pipeline Failed =====' }
        cleanup { echo '===== Cleaning Jenkins Workspace ====='; deleteDir() }
    }
}
