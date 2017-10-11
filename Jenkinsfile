node{
  def nodeHome = tool name: 'nodejs-8.6.0', type: 'jenkins.plugins.nodejs.tools.NodeJSInstallation'
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
