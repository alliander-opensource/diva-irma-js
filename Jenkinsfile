node{
  def nodeHome = tool name: 'nodejs-6.11.1', type: 'jenkins.plugins.nodejs.tools.NodeJSInstallation'
  env.PATH = "${nodeHome}/bin:${env.PATH}"

  stage ('Checkout') {
    checkout scm
    sh 'npm install'
  }


  stage ('Lint') {
    sh 'npm run lint'
  }

  stage ('Test') {
    sh 'echo TODO'
  }
}
