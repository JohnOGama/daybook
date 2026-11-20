def daybook(String stage, String status, String message = '') {
  try {
    def file = ".daybook-${stage.replaceAll('[^A-Za-z0-9_-]', '_')}.json"
    writeFile file: file, text: groovy.json.JsonOutput.toJson([job: env.JOB_NAME, run: env.BUILD_NUMBER, url: env.BUILD_URL, stage: stage, status: status, message: message])
    sh label: 'Report to Daybook', script: "curl -sS -m 5 -X POST \"\$DAYBOOK_URL/api/pipelines/report\" -H \"Authorization: Bearer \$DAYBOOK_KEY\" -H 'Content-Type: application/json' --data @${file} || true"
  } catch (e) {
    echo "Daybook report skipped: ${e}"
  }
}
def daybookFinish(String status) {
  try {
    writeFile file: '.daybook-run.json', text: groovy.json.JsonOutput.toJson([job: env.JOB_NAME, run: env.BUILD_NUMBER, url: env.BUILD_URL, status: status])
    sh label: 'Report to Daybook', script: "curl -sS -m 5 -X POST \"\$DAYBOOK_URL/api/pipelines/report\" -H \"Authorization: Bearer \$DAYBOOK_KEY\" -H 'Content-Type: application/json' --data @.daybook-run.json || true"
  } catch (e) {
    echo "Daybook report skipped: ${e}"
  }
}
pipeline {
    agent any

    tools {
        nodejs("Node 22")
    }

    environment {
        DAYBOOK_URL = 'http://localhost:3000'
        DAYBOOK_KEY = credentials('DAYBOOK_DAYBOOK_KEY')
        SERVER_IP    = credentials('SERVER_IP')
        IMAGE_NAME   = 'johnogama19/daybook-backend'
        IMAGE_TAG    = "${BUILD_NUMBER}"
        PROJECT_PATH = '/home/jogama/projects/daybook'
    }

    stages {
        stage('Github Clone') {
            steps {
                daybook('Github Clone', 'started')
                checkout scmGit(
                    branches: [[name: '*/main']],
                    extensions: [],
                    userRemoteConfigs: [[
                        credentialsId: 'JENKINS_GITHUB_PRIVATE_KEY',
                        url: 'git@github.com:JohnOGama/daybook.git'
                    ]]
                )
            }
            post {
                success { daybook('Github Clone', 'passed') }
                failure { daybook('Github Clone', 'failed', 'Github Clone failed, see Jenkins') }
            }
        }

        stage('Install Dependencies + Build') {
            steps {
                daybook('Install Dependencies + Build', 'started')
                // Node 22.1.0's bundled corepack can't verify npm's new signing keys, so skip it.
                sh 'node -v && uname -m'
                sh 'npm install -g pnpm@10.5.2'
                sh 'pnpm api:install'
                sh 'pnpm api:build'
            }
            post {
                success { daybook('Install Dependencies + Build', 'passed') }
                failure { daybook('Install Dependencies + Build', 'failed', 'Install Dependencies + Build failed, see Jenkins') }
            }
        }

        stage('Database Migration') {
            steps {
                daybook('Database Migration', 'started')
                withCredentials([string(credentialsId: 'DAYBOOK_DATABASE_URL', variable: 'DATABASE_URL')]) {
                    sh 'pnpm api:migrate'
                }
            }
            post {
                success { daybook('Database Migration', 'passed') }
                failure { daybook('Database Migration', 'failed', 'Database Migration failed, see Jenkins') }
            }
        }

        stage('Copy Docker compose and Nginx') {
            steps {
                daybook('Copy Docker compose and Nginx', 'started')
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
            post {
                success { daybook('Copy Docker compose and Nginx', 'passed') }
                failure { daybook('Copy Docker compose and Nginx', 'failed', 'Copy Docker compose and Nginx failed, see Jenkins') }
            }
        }

        stage('Login to Docker') {
            steps {
                daybook('Login to Docker', 'started')
                withCredentials([usernamePassword(
                    credentialsId: 'DOCKER_HUB_CREDS',
                    passwordVariable: 'DOCKER_PSW',
                    usernameVariable: 'DOCKER_USR'
                )]) {
                    sh 'echo "$DOCKER_PSW" | docker login -u "$DOCKER_USR" --password-stdin'
                }
            }
            post {
                success { daybook('Login to Docker', 'passed') }
                failure { daybook('Login to Docker', 'failed', 'Login to Docker failed, see Jenkins') }
            }
        }

        stage('Docker Build + Push') {
            steps {
                daybook('Docker Build + Push', 'started')
                sh '''
                    docker build -f apps/api/Dockerfile -t $IMAGE_NAME:$IMAGE_TAG .
                    docker push $IMAGE_NAME:$IMAGE_TAG
                '''
            }
            post {
                success { daybook('Docker Build + Push', 'passed') }
                failure { daybook('Docker Build + Push', 'failed', 'Docker Build + Push failed, see Jenkins') }
            }
        }

        stage('Nginx revalidate') {
            steps {
                daybook('Nginx revalidate', 'started')
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
            post {
                success { daybook('Nginx revalidate', 'passed') }
                failure { daybook('Nginx revalidate', 'failed', 'Nginx revalidate failed, see Jenkins') }
            }
        }

        stage('SSH To Server + Docker Pull') {
            steps {
                daybook('SSH To Server + Docker Pull', 'started')
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
            post {
                success { daybook('SSH To Server + Docker Pull', 'passed') }
                failure { daybook('SSH To Server + Docker Pull', 'failed', 'SSH To Server + Docker Pull failed, see Jenkins') }
            }
        }
    }

    post {
        success { daybookFinish('passed') }
        failure { daybookFinish('failed') }
        aborted { daybookFinish('aborted') }
        always  { echo '===== Pipeline Finished ====='; sh 'docker logout' }
        success { echo '===== Pipeline Successful =====' }
        failure { echo '===== Pipeline Failed =====' }
        cleanup { echo '===== Cleaning Jenkins Workspace ====='; deleteDir() }
    }
}